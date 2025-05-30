
// const fs = require("fs");
import fs from "fs";
import path from "path";
// const path = require("path");
// const { parseLuceeExecLog, LuceeExectionLog, LuceeExecutionLogHeader} = require( "../../out/utils/luceeExecLogParser" );
import {
	LuceeExecutionLogHeader,
	LuceeExectionLog,
	LuceeExectionReport,
} from "../../src/utils/luceeExecLogParser";

describe( "LueeExecutionLogParsing", () => {
	describe( "LuceeExecutionLogHeader", () => {
		it( "should parse the header into LuceeExecutionLogHeader", () => {
			const header = new LuceeExecutionLogHeader(
				"someheader:header\nkey2: value2\nkey3: value3"
			);

			expect( header.keys.someheader ).toBe( "header" );
		} );

		it( "should correctly parse a simple header string", () => {
			const headerStr = "key1: value1\nkey2: value2\nkey3: value3";
			const header = new LuceeExecutionLogHeader( headerStr );

			expect( header.keys ).toHaveProperty( "key1" );
		} );

		it( "should trim whitespace from keys and values", () => {
			const headerStr = " key1 : value1 \nkey2:    value2\n key3: value3 ";
			const header = new LuceeExecutionLogHeader( headerStr );
			expect( header.keys ).toHaveProperty( "key2" );
			expect( header.keys["key2"] ).toBe( "value2" );
		} );

		it( "should ignore lines without a colon", () => {
			const headerStr = "key1: value1\ninvalidline\nkey2: value2";
			const header = new LuceeExecutionLogHeader( headerStr );
			expect( header.keys ).not.toHaveProperty( "invalidline" );
		} );

		it( "should handle empty header string", () => {
			const headerStr = "";
			const header = new LuceeExecutionLogHeader( headerStr );

			expect( header.keys ).toHaveProperty( "remoteUser" );
			expect( header.keys ).toHaveProperty( "remoteAddr" );
			expect( header.keys ).toHaveProperty( "remoteHost" );
			expect( header.keys ).toHaveProperty( "scriptName" );
			expect( header.keys ).toHaveProperty( "serverName" );
			expect( header.keys ).toHaveProperty( "protocol" );
			expect( header.keys ).toHaveProperty( "serverPort" );
			expect( header.keys ).toHaveProperty( "pathInfo" );
			expect( header.keys ).toHaveProperty( "queryString" );
			expect( header.keys ).toHaveProperty( "unit" );
			expect( header.keys ).toHaveProperty( "minTimeNano" );
			expect( header.keys ).toHaveProperty( "executionTime" );

		} );

		it( "should handle header with only invalid lines", () => {
			const headerStr = "invalidline1\ninvalidline2";
			const header = new LuceeExecutionLogHeader( headerStr );
			expect( header.keys ).not.toHaveProperty( "invalidline1" );
			expect( header.keys ).not.toHaveProperty( "invalidline2" );
		} );
		it( "should parse query-string into a recrd", () => {
			const headerStr = "query-string:runid=xyz23334&directory=luceeCoverage";
			const header = new LuceeExecutionLogHeader( headerStr );
			expect( header.keys ).toHaveProperty( "queryString" );
			expect( header.keys["queryString"] ).toHaveProperty( "runid" );
			// expect( header.getQueryStringValue( "runid" ) ).toBe( "xyz23334" );
		} );
		// TODO, maybe convert this to LCOV?
	} );

	describe( "LuceeExectionLog", () => {
		const logPath = "./resources/luceeCoverage/lucee_execution_log.exl";
		const logFile = path.join( __dirname, logPath );
		const logFileContent = fs.readFileSync( logFile, "utf-8" );

		it( "should parse the log file", () => {
			const content = `context-path:
    remote-user:
    remote-addr:127.0.0.1
    remote-host:127.0.0.1
    script-name:/tests/runner.cfm
    server-name:127.0.0.1
    protocol:HTTP/1.1
    server-port:49616
    path-info:
    query-string:runid=xyz23334
    unit:μs
    min-time-nano:500
    execution-time:38849

    0:/TestBox/tests/Application.cfc
    1:/TestBox/tests/runner.cfm
    2:/TestBox/system/runners/HTMLRunner.cfm
    3:/TestBox/system/TestBox.cfc

    0	1089	1126	145
    0	1129	1184	85
    0	1194	1243	1331
    0	1259	1268	15
    0	1012	1018	1
    1	0	10	8
    1	35	36	2
    1	120	128	10
    1	170	178	1
    1	226	234	12`;

			const ExecutionLog = new LuceeExectionLog( content );

			const runid = ExecutionLog.header.getQueryStringValue( "runid" );
			expect( runid ).toBe( "xyz23334" );
			const files = ExecutionLog.getFiles();
			expect( files.length ).toBe( 4 );

			const metric = ExecutionLog.metrics[0];
			expect( metric.file ).toBe( "/TestBox/tests/Application.cfc" );
			// const log = parseLuceeExecLog(logFileContent);
			// expect(log).toBeInstanceOf(LuceeExectionLog);
			// expect(log.getFile()).toBe("luceeCoverage");
			// expect(log.getStartPosition()).toBe(0);
			// expect(log.getEndPosition()).toBe(100);
			// expect(log.getExecutionTime()).toBe(200);
		} );
	} );

	describe( "LuceeExectutionReport", () => {
		it( "should generate  the report from a absolute directory", () => {
			const directory = path.join( __dirname, "./resources/luceeCoverage/" );
			const report = new LuceeExectionReport( directory );
			expect( report ).toBeInstanceOf( LuceeExectionReport );
			expect( report.getLogs().length ).toBe( 2 );
		} );
	} );
} );
