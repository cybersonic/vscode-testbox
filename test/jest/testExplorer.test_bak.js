// const {  renderResult} = require('../../src/views/testExplorer');
const fs = require('fs');

let mainOutput = ""
const run = {
    appendOutput: function (output) {   
        // console.log(output);
        mainOutput += output;
    }
}

// describe('resultOutput', () => {
//     // // TODO: Remove details
//     // const output = {
//     //     "totalSuites": 0,
//     //     "CFMLEngineVersion": "6.1.2.30-SNAPSHOT",
//     //     "startTime": 1747067528343,
//     //     "bundleStats": [
//     //         {
//     //             "totalSuites": 0,
//     //             "startTime": 1747067528349,
//     //             "totalPass": 0,
//     //             "totalDuration": 0,
//     //             "totalSkipped": 0,
//     //             "totalFail": 0,
//     //             "totalSpecs": 0,
//     //             "path": "tests.testcases.app.services.bank.WeOweYouModelTest",
//     //             "endTime": 1747067528349,
//     //             "debugBuffer": [],
//     //             "totalError": -1,
//     //             "name": "tests.testcases.app.services.bank.WeOweYouModelTest",
//     //             "id": "C655169B2FCED7CA5D6B790D28081F70",
//     //             "suiteStats": [],
//     //             "globalException": {}
//     //         }
//     //     ],
//     //     "totalPass": 3,
//     //     "totalDuration": 6,
//     //     "version": "4.5.0",
//     //     "totalSkipped": 0,
//     //     "totalFail": 0,
//     //     "totalSpecs": 0,
//     //     "excludes": [
//     //         "IterableTestData.cfc",
//     //         "tests.testcases.system.compile.CompileTest"
//     //     ],
//     //     "labels": [],
//     //     "resultID": "",
//     //     "endTime": 1747067528349,
//     //     "coverage": {
//     //         "data": {},
//     //         "enabled": false
//     //     },
//     //     "totalError": -1,
//     //     "CFMLEngine": "Lucee",
//     //     "totalBundles": 1
//     // }

   
//     it('should return the correct output for passed and skipped tests', () => {
//         const resultsJSON = fs.readFileSync('./test/jest/samples/calcSpecPassed.json', 'utf8');
//         const results = JSON.parse(resultsJSON);

//         mainOutput = "";
//         const res = renderResult(results, run);
//         console.log(mainOutput)
//         expect(mainOutput).toContain("tests.specs.unit.CalculatorTest");
//         expect(mainOutput).toContain("√ My First Suite");
//         expect(mainOutput).toContain("- My Second Suite");
//     });

//     it('should return the correct output for failed and errored tests', () => {
//         const resultsJSON = fs.readFileSync('./test/jest/samples/calSpecFailErrors.json', 'utf8');
//         const results = JSON.parse(resultsJSON);

//         mainOutput = "";
//         const res = renderResult(results, run);
//         console.log(mainOutput)
//         expect(mainOutput).toContain("tests.specs.unit.CalculatorTest");
//         expect(mainOutput).toContain("X My First Suite");
//         expect(mainOutput).toContain("- should be skipped");
//         expect(mainOutput).toContain("-> Failure: Expected [2] but received [1]");
//         expect(mainOutput).toContain("-> Failure: spec has not been implemented");
//     });
   


// });



// describe("Hashing Matches", () => {

//     const hashedElvis = "8B28C7134887BB938E1FFED68456FFB2";
//     const hashedTitle = "95AD76505F0B02B01CB715EAEB6EE3D6";

//     it("should return the correct hash for a given string", () => {
//         const result = crypto.createHash("md5").update("elvis", 'utf8').digest('hex').toUpperCase();
//         expect(result).toBe(hashedElvis);
//     });
//     xit("should return the correct hash for a given string2", () => {
//         const result = crypto.createHash("md5").update("should query the distroKid Read Replica Database without using datasource in cfquery", 'utf8').digest('hex').toUpperCase();
//         expect(result).toBe(hashedTitle);
//     });
// });