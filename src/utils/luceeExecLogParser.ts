// I parse a lucee exec log file and return the results of the code exectuion of indivual expressions and statements
// @see https://github.com/lucee/lucee-docs/blob/master/docs/recipes/execution-log.md#consoleexecutionl

import fs from "fs";
import path from "path";

export class LuceeExectionReport {
  logs: Array<LuceeExectionLog> = [];
  constructor(logPath: string) {
    fs.readdirSync(logPath).forEach((file) => {
      const filePath = path.join(logPath, file);
      if (fs.statSync(filePath).isFile()) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const log = new LuceeExectionLog(fileContent);
        log.logFilePath = filePath;
        this.logs.push(log);
      }
    });
    // this.logs = fs
    //   .readdirSync(logPath)
  }
  addLog(log: LuceeExectionLog) {
    this.logs.push(log);
  }
  getLogs() {
    return this.logs;
  }
}

/**
 * Represents a parsed Lucee execution log, containing the log header,
 * a list of associated files, and an array of execution metrics.
 *
 * @remarks
 * This class is used to encapsulate the structured data extracted from a Lucee execution log file.
 *
 * @property header - The header information of the execution log.
 * @property files - An array of file paths or names referenced in the log.
 * @property metrics - An array of metric objects representing execution statistics.
 */
export class LuceeExectionLog {
  logFilePath: string | null = null;
  header: LuceeExecutionLogHeader;
  files: string[] = [];
  metrics: Array<LuceeExectionMetric>;

  constructor(content: string) {
    const lines = content.split("\n\n");
    this.header = new LuceeExecutionLogHeader(lines[0]);
    this.files = [];
    this.metrics = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("file:")) {
        this.files.push(line.split(":")[1].trim());
      } else if (line.startsWith("metric:")) {
        const metricData = line.split(":")[1].trim().split(",");
        const metric = new LuceeExectionMetric(
          metricData[0],
          parseInt(metricData[1]),
          parseInt(metricData[2]),
          parseInt(metricData[3])
        );
        this.metrics.push(metric);
      }
    }

    const files = lines[1].split("\n");
    this.files = new Array<string>(files.length);

    for (const line of files) {
      const [key, value] = line.split(":");
      if (key && value) {
        this.files[parseInt(key)] = value.trim();
      }
    }
    const metrics = lines[2].split("\n");
    for (const metric of metrics) {
      try {
        const [index, start, end, time] = metric.split("\t");
        if (!index || !start || !end || !time) {
          // console.error("Invalid metric line: ", metric);
          continue;
        }
        this.metrics.push(
          new LuceeExectionMetric(
            this.files[parseInt(index)],
            parseInt(start),
            parseInt(end),
            parseInt(time)
          )
        );
      } catch (e) {
        console.error("Error parsing metric line: ", metric, e);
      }
    }
  }
  getHeader() {
    return this.header;
  }
  getFiles() {
    return this.files;
  }
  getMetrics() {
    return this.metrics;
  }
}

/**
 * Parses and stores key-value pairs from a Lucee execution log header string.
 * @property keys - An object containing all parsed header keys and their corresponding values.
 *  The value for `query-string` is an object of query parameters.
 *
 * @method getQueryStringValue
 * Retrieves the value of a specific query parameter from the parsed `query-string`.
 *
 * @param key - The name of the query parameter to retrieve.
 * @returns The value of the specified query parameter, or `null` if not found.
 */
export class LuceeExecutionLogHeader {
  keys:LuceeExecutionLogHeaderKeys = {
    contextPath: "",
    remoteUser: "",
    remoteAddr: "",
    remoteHost: "",
    scriptName: "",
    serverName: "",
    protocol: "",
    serverPort: "",
    pathInfo: "",
    queryString: {},
    unit: "",
    minTimeNano: "",
    executionTime: "",
  };

  constructor(header: string) {
    // this.keys = keys;
    console.log("Header: ", header);
    const lines = header.split("\n");
    for (const line of lines) {
      const [key, value] = line.split(":");
      if (key && value) {
        if (key.trim() === "query-string") {
          const queryString = value.trim();
          const paramStruct: Record<string, any> = {};

          const queryParams = queryString.split("&");
          for (const param of queryParams) {
            const [paramKey, paramValue] = param.split("=");
            paramStruct[paramKey] = paramValue;
          }

          this.keys["queryString"] = paramStruct;
        } 
        else {
          const camelCaseKey = this.convertToCamelCase(key.trim());
          this.keys[camelCaseKey] = value.trim();
        }
      }
    }
  }
  private convertToCamelCase(key: string) {
    return key
      .replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      .replace(/_/g, "");
  }
  getQueryStringValue(key: string) {
    if (this.keys["query-string"] && this.keys["query-string"][key]) {
      return this.keys["query-string"][key];
    }
    return null;
  }
}

interface LuceeExecutionLogHeaderKeys {
  [key: string]: any;
  contextPath:string;
  remoteUser:string;
  remoteAddr:string;
  remoteHost:string;
  scriptName:string;
  serverName:string;
  protocol:string;
  serverPort:string;
  pathInfo:string;
  queryString:any;
  unit:string;
  minTimeNano:string;
  executionTime:string;
}
/**
 * Represents a metric for a single execution event in Lucee.
 *
 * @remarks
 * This class is used to store information about a code execution segment,
 * including the file path, start and end positions within the file, and
 * the execution time in milliseconds.
 *
 * @example
 * ```typescript
 * const metric = new LuceeExectionMetric('example.cfm', 10, 50, 25);
 * ```
 *
 * @property file - The path or name of the file where the execution occurred.
 * @property startPosition - The starting character position of the execution segment.
 * @property endPosition - The ending character position of the execution segment.
 * @property executionTime - The time taken to execute the segment, in milliseconds.
 */
export class LuceeExectionMetric {
  file: string;
  startPosition: number;
  endPosition: number;
  executionTime: number;
  constructor(
    file: string,
    startPosition: number,
    endPosition: number,
    executionTime: number
  ) {
    this.file = file;
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.executionTime = executionTime;
  }
}
