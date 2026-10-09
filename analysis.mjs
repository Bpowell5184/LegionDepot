import { doRolls } from "./doRolls.mjs";
import fs from 'node:fs';
import * as dotenv from 'dotenv';
import troopData from "./troops.json" with { type: "json" };
import path from "node:path";

dotenv.config();

const unitOneName = process.env.UNIT_ONE_NAME;
const unitTwoName = process.env.UNIT_TWO_NAME;
const numRuns = process.env.NUM_RUNS;
const numLogs = process.env.NUM_LOGS; // Number of logs to generate (can be 0)
let unitOneWins = 0;
let unitTwoWins = 0;

if (process.env.CLEAN_LOGS === "true") cleanLogs();
runProgram();

function runProgram(){
    let currentRun = 0;
    let flip = true;
    const basefileNum = createFileNum();
    let fileLocation = basefileNum;
    while (currentRun < numRuns){
        const units = troopData;
        const unitOne = getUnit(units, unitOneName);
        const unitTwo = getUnit(units, unitTwoName);
        if (currentRun % (numRuns/numLogs) == 0 && numLogs != 0) {
            fileLocation++;
            writeToFile(`Battle ${fileLocation}: ${unitOneName} vs. ${unitTwoName}`, fileLocation);
            if (flip) doRun(unitTwo, unitOne, true, fileLocation);
            else doRun(unitOne, unitTwo, true, fileLocation);
        } 
        else {
            if (flip) doRun(unitTwo, unitOne, false, fileLocation);
            else doRun(unitOne, unitTwo, false, fileLocation);
        }   
        currentRun++;
        flip = !flip;
    }
    const totalMatches = unitOneWins + unitTwoWins;
    console.log(`${unitOneName} Winrate: ${unitOneWins/totalMatches}`);
    console.log(`${unitTwoName} Winrate: ${unitTwoWins/totalMatches}`);
}

function doRun(unitOne, unitTwo, isLogged, fileLocation){
    let gameState = 0;
    while (unitOne.Models > 0 && unitTwo.Models > 0){
        if (gameState == 0){
            const unitOnePaint = unitAttack(unitOne, isLogged, fileLocation);
            if (unitOnePaint != 0){
                const unitTwoPaint = unitDefense(unitTwo, unitOnePaint, isLogged, fileLocation);
                let wounds = calculateWounds(unitOnePaint, unitTwoPaint);
                unitTwo.Models = unitTwo.Models - wounds;
                if (isLogged){
                    writeToFile(`${unitTwo.name} wounds received: ${wounds}`, fileLocation);
                    writeToFile(`New ${unitTwo.name} Model Count is: ${unitTwo.Models}`, fileLocation);
                }
            }
            gameState = 1;
        } else if (gameState == 1){
            const unitTwoPaint = unitAttack(unitTwo, false, fileLocation);
            if (unitTwoPaint != 0){
                const unitOnePaint = unitDefense(unitOne, unitTwoPaint, false, fileLocation);
                let wounds = calculateWounds(unitTwoPaint, unitOnePaint)
                unitOne.Models = unitOne.Models - wounds;
                if (isLogged){
                    writeToFile(`${unitOne.name} wounds received: ${wounds}`, fileLocation);
                    writeToFile(`New ${unitOne.name} Model Count is: ${unitOne.Models}`, fileLocation);
                }
            }
            gameState = 0;
        }
    }

    if (isLogged){
        if (unitOne.Models <= 0){
            writeToFile(`Battle Droids Win!`, fileLocation);
            unitTwoWins++;
        } else if (unitTwo.Models <= 0){
            writeToFile(`Stormtroopers Win!`, fileLocation);
            unitOneWins++;
        }
    }
    else {
        if (unitOne.Models <= 0) unitTwoWins++; 
        else if (unitTwo.Models <= 0) unitOneWins++;
    }
}

function unitAttack(inUnit, logged, fileLocation){
    const inUnitAttack = inUnit.Models + inUnit.AttackDice;
    let rollArray = doRolls('a', inUnitAttack);
    const inUnitPaint = convertPaint(rollArray, inUnit.SurgeAttack, "a");
    if (logged) {
        writeToFile(`${inUnit.name} is attacking!`, fileLocation);
        writeToFile(`Roll Array for ${inUnit.name} is ${rollArray}`, fileLocation);
        writeToFile(`Paint amount for ${inUnit.name} is ${inUnitPaint}`, fileLocation);
    }
    return inUnitPaint;
}

function unitDefense(inUnit, enemyPaint, logged, fileLocation){
    const inUnitDefense = enemyPaint + inUnit.DefenseDice;
    let rollArray = doRolls('d', inUnitDefense);
    const inUnitPaint = convertPaint(rollArray, inUnit.SurgeDefense, "d");
    if (logged) {
        writeToFile(`${inUnit.name} is defending!`, fileLocation);
        writeToFile(`Roll Array for ${inUnit.name} is ${rollArray}`, fileLocation);
        writeToFile(`Paint amount for ${inUnit.name} is ${inUnitPaint}`, fileLocation);
    }
    return inUnitPaint;
}

function getUnit(units, name){
    return { name, ...units[name] };
}

function writeToFile(message, location){
        fs.writeFileSync(`./logs/battle_${location}`, message+'\n', { flag: 'a+' });
}

function cleanLogs(){
    const files = fs.readdirSync('./logs');
    for (const file of files){
        fs.unlinkSync(path.join('./logs', file))
    }
}

function createFileNum(){
    const numbers = fs.readdirSync('./logs', { withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => e.name.match(/_(\d+)$/))
    .filter(match => match != null)
    .map(match => Number(match[1]));

    const max = numbers.length ? Math.max(...numbers) : 0;
    return max;
}

function convertPaint(rolls, surgeProfile, rollType){
    let paint = -1;
    if (rollType === "a") paint = convertAttackPaint(rolls, surgeProfile);
    else if (rollType === "d") paint = convertDefensePaint(rolls, surgeProfile);
    else console.log("Invalid Roll Type (Must be Attack or Defense)");
    return paint;
}

function convertAttackPaint(rolls, surgeProfile){
    let paint = 0;
    for (let step = 0; step < rolls.length; step++){
        if (rolls[step] == "Hit" || rolls[step] == "Crit"){
            paint++;
        } else if (rolls[step] == "Surge" && surgeProfile !== "n"){
            paint++;
        }
    }
    return paint;  
}

function convertDefensePaint(rolls, surgeProfile){
    let paint = 0;
    for (let step = 0; step < rolls.length; step++){
        if (rolls[step] == "Block"){
            paint++;
        } else if(rolls[step] == "Surge" && surgeProfile === "b"){
            paint++;
        }
    } 
    return paint; 
}

function calculateWounds(attackPaint, defendingPaint){
    return attackPaint - defendingPaint < 0 ? 0 : attackPaint - defendingPaint;
}