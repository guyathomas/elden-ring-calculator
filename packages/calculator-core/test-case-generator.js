
/**
 * =================================================================
 * Script used to generate er-calc-test-cases.csv
 * =================================================================
 */
const CONFIG = {
  RANGES: {
    weaponClass: 'G10',
    weapon: 'G11',
    affinity: 'G12',
    upgradeLevel: 'G13',
    stats: {
      strength: 'G15',
      dexterity: 'G16',
      intelligence: 'G17',
      faith: 'G18',
      arcane: 'G19',
    },
    twoHanded: 'G20',
    ignoreReqs: 'G21',
    outputMatrices: [
      { label: 'AP/SP', range: 'E29:L45' },
      { label: 'Scaling', range: 'N11:S14' },
      { label: 'AttributeSaturation', range: 'N17:S26' },
      { label: 'AttributeScaling', range: 'N29:S45' },
    ],
    // Scaling row used to determine which stats affect damage
    scalingRow: 'O13:S13',
  },
  // Controlling the values in this array will control the values that are calculated.
  weaponClasses: [
    'Fist',
    'Dagger',
    'Twinblade',
    'Bow',
    'Sacred Seal',
    'Glintstone Staff',
    'Perfume Bottle',
    'Katana',
  ],

  weaponsForClass: {
    'Fist': ['Unarmed'],
    'Bow': ['Longbow'],
    'Sacred Seal': ['Finger Seal', 'Erdtree Seal'],
    'Glintstone Staff': ['Academy Glintstone Staff'],
    'Perfume Bottle': ['Firespark Perfume Bottle'],
    'Katana': [ 'Uchigatana', 'Moonveil', 'Rivers of Blood'],
  },


  // Bring desired affinities into CONFIG
  desiredAffinities: [
    'Standard',
    'Heavy',
    'Keen',
    'Quality',
    'Fire',
    'Flame Art',
    'Lightning',
    'Sacred',
    'Magic',
    'Cold',
    'Poison',
    'Blood',
    'Occult',
  ],

  ignoreReqs: [false, true],
  '2h': [false, true],
  statValues: [5, 30, 50],
};


/**
 * Main function to generate permutations and write them to a CSV sheet.
 */
function generateHybridPermutations() {
  const ss = SpreadsheetApp.getActive();
  const apSheet = ss.getSheetByName('AP Calc');

  // --- Setup the output sheet ---
  const outputSheetName = "Test Cases";
  let outputSheet = ss.getSheetByName(outputSheetName);
  if (!outputSheet) {
    outputSheet = ss.insertSheet(outputSheetName);
  }

  // --- Parse all output matrices to get headers, rows, and their positions ---
  const colHeaderInfo = [];
  let rowLabels = [];
  let originalRowLabels = [];

  CONFIG.RANGES.outputMatrices.forEach((matrixInfo, matrixIndex) => {
    const outputMatrixValues = apSheet.getRange(matrixInfo.range).getValues();

    outputMatrixValues[0].forEach((header, colIndex) => {
      if (colIndex > 0 && header) {
        colHeaderInfo.push({
          label: header.toString(),
          columnIndex: colIndex,
          matrixIndex: matrixIndex,
          matrixLabel: matrixInfo.label
        });
      }
    });

    if (matrixIndex === 0) {
      originalRowLabels = outputMatrixValues.slice(1).map(row => row[0]).filter(String);
      rowLabels = originalRowLabels.map(toCamelCase);
    }
  });

  // --- Create the header row ---
  const inputHeaders = [
    'Weapon Class', 'Weapon', 'Upgrade Level', 'Affinity',
    'Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane',
    'twoHanded', 'Ignore Requirements'
  ];

  const outputHeaders = [];
  for (const originalRowLabel of originalRowLabels) {
    for (const headerInfo of colHeaderInfo) {
      const header = `${headerInfo.matrixLabel}_${originalRowLabel}_${headerInfo.label}`.replace(/\s+/g, '_');
      outputHeaders.push(header);
    }
  }
  const fullHeader = [...inputHeaders, ...outputHeaders];

  // Collect all rows in memory for batch write
  const allRows = [];

  // Only add header if sheet is empty
  if (outputSheet.getLastRow() === 0) {
    allRows.push(fullHeader);
  }

  Logger.log("Starting permutation generation...");

  // --- Main Permutation Loops ---
  for (const weaponClass of CONFIG.weaponClasses) {
    const weapons = CONFIG.weaponsForClass[weaponClass] || [];
    for (const weapon of weapons) {
      Logger.log(`Info: Starting ${weapon}`);
      apSheet.getRange(CONFIG.RANGES.weaponClass).setValue(weaponClass);
      apSheet.getRange(CONFIG.RANGES.weapon).setValue(weapon);
      SpreadsheetApp.flush();

      const availableAffinities = getValidationValues_(apSheet, CONFIG.RANGES.affinity);
      let affinitiesToTest = [];

      if (availableAffinities.length === 1) {
        affinitiesToTest = availableAffinities;
      } else if (Array.isArray(CONFIG.desiredAffinities) && CONFIG.desiredAffinities.length > 0) {
        affinitiesToTest = availableAffinities.filter(aff => CONFIG.desiredAffinities.includes(aff));
        if (affinitiesToTest.length === 0) {
          Logger.log(`Warning: None of the configured desiredAffinities (${CONFIG.desiredAffinities.join(', ')}) were available for ${weapon}. Using all available affinities.`);
          affinitiesToTest = availableAffinities;
        }
      } else {
        affinitiesToTest = availableAffinities;
      }

      let upgradeLevelsToTest = [0];
      const allowedLevels = getValidationValues_(apSheet, CONFIG.RANGES.upgradeLevel);
      const maxLevel = allowedLevels[allowedLevels.length - 1];
      if (maxLevel !== undefined && maxLevel !== null) {
        upgradeLevelsToTest.push(maxLevel);
      } else {
        Logger.log(`Warning: Could not determine numeric upgrade range for ${weapon}. Defaulting to 0.`);
      }

      for (const upgradeLevel of upgradeLevelsToTest) {
        apSheet.getRange(CONFIG.RANGES.upgradeLevel).setValue(upgradeLevel);

        for (const affinity of affinitiesToTest) {
          apSheet.getRange(CONFIG.RANGES.affinity).setValue(affinity);
          SpreadsheetApp.flush();

          // Read scaling AFTER setting weapon, upgrade level, and affinity
          const [strScaling, dexScaling, intScaling, faiScaling, arcScaling] =
            apSheet.getRange(CONFIG.RANGES.scalingRow).getValues()[0];

          Logger.log(`Debug: ${weapon} / ${affinity} / +${upgradeLevel} scaling: STR=${strScaling}, DEX=${dexScaling}, INT=${intScaling}, FAI=${faiScaling}, ARC=${arcScaling}`);

          const strValues = strScaling ? CONFIG.statValues : [1];
          const dexValues = dexScaling ? CONFIG.statValues : [1];
          const intValues = intScaling ? CONFIG.statValues : [1];
          const faiValues = faiScaling ? CONFIG.statValues : [1];
          const arcValues = arcScaling ? CONFIG.statValues : [1];

          for (const str of strValues) {
            for (const dex of dexValues) {
              for (const int of intValues) {
                for (const fai of faiValues) {
                  for (const arc of arcValues) {
                    for (const isTwoHanded of CONFIG['2h']) {
                      for (const ignoreReqs of CONFIG.ignoreReqs) {

                        const input = {
                          weaponClass, weapon, upgradeLevel, affinity,
                          stats: { strength: str, dexterity: dex, intelligence: int, faith: fai, arcane: arc },
                          twoHanded: isTwoHanded, ignoreRequirements: ignoreReqs
                        };

                        // Set all input values
                        const statRanges = CONFIG.RANGES.stats;
                        apSheet.getRange(statRanges.strength).setValue(input.stats.strength);
                        apSheet.getRange(statRanges.dexterity).setValue(input.stats.dexterity);
                        apSheet.getRange(statRanges.intelligence).setValue(input.stats.intelligence);
                        apSheet.getRange(statRanges.faith).setValue(input.stats.faith);
                        apSheet.getRange(statRanges.arcane).setValue(input.stats.arcane);
                        apSheet.getRange(CONFIG.RANGES.twoHanded).setValue(input.twoHanded);
                        apSheet.getRange(CONFIG.RANGES.ignoreReqs).setValue(input.ignoreRequirements);
                        SpreadsheetApp.flush();

                        // Read all output matrices
                        const currentMatricesValues = CONFIG.RANGES.outputMatrices.map(matrixInfo =>
                          apSheet.getRange(matrixInfo.range).getValues()
                        );

                        const outputJson = {};
                        rowLabels.forEach((rowLabel, rowIndex) => {
                          outputJson[rowLabel] = {};
                          const actualRowIndexInSheet = rowIndex + 1;

                          colHeaderInfo.forEach(headerInfo => {
                            const targetMatrixData = currentMatricesValues[headerInfo.matrixIndex];
                            const matrixRow = targetMatrixData[actualRowIndexInSheet];

                            let value = null;
                            if (matrixRow) {
                              value = matrixRow[headerInfo.columnIndex];
                            }

                            const uniqueKey = `${headerInfo.matrixLabel}_${headerInfo.label}`;
                            outputJson[rowLabel][uniqueKey] = value;
                          });
                        });

                        const rowData = [
                          input.weaponClass, input.weapon, input.upgradeLevel, input.affinity,
                          input.stats.strength, input.stats.dexterity, input.stats.intelligence,
                          input.stats.faith, input.stats.arcane,
                          input.twoHanded, input.ignoreRequirements
                        ];

                        for (const rowLabel of rowLabels) {
                          for (const headerInfo of colHeaderInfo) {
                            const uniqueKey = `${headerInfo.matrixLabel}_${headerInfo.label}`;
                            rowData.push(outputJson[rowLabel]?.[uniqueKey] ?? '');
                          }
                        }

                        allRows.push(rowData);

                      } // end ignoreReqs
                    } // end twoHanded
                  } // end arcane
                } // end faith
              } // end intelligence
            } // end dexterity
          } // end strength
        } // end affinity
      } // end upgradeLevel
    } // end weapon
  } // end weaponClass

  // --- Batch write all rows starting from first empty row ---
  if (allRows.length > 0) {
    const startRow = outputSheet.getLastRow() + 1;
    Logger.log(`Writing ${allRows.length} rows starting at row ${startRow}...`);
    outputSheet.getRange(startRow, 1, allRows.length, allRows[0].length).setValues(allRows);
  }

  Logger.log("Permutation run finished. See the '" + outputSheetName + "' sheet for results.");
}


// --- HELPER FUNCTIONS ---

function getValidationValues_(sheet, rangeA1) {
  const rule = sheet.getRange(rangeA1).getDataValidation();
  if (!rule) {
    Logger.log(`Warning: No data validation rule found on cell ${rangeA1}.`);
    return [];
  }
  const criteria = rule.getCriteriaType();
  const criteriaValues = rule.getCriteriaValues();
  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return criteriaValues[0];
  }
  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    const range = criteriaValues[0];
    return range.getValues().flat().filter(String);
  }
  return [];
}

function toCamelCase(str) {
  if (!str) return '';
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
}
