/**
 * Shared Oracle Database Connection Module
 * Uses environment variables for secure credential management
 */

const oracledb = require('oracledb');

// Configure Oracle client for optimal performance
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.autoCommit = true;

/**
 * Get Oracle connection from environment variables
 * @returns {Promise<Connection>}
 */
async function getConnection() {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONN_STRING
    });
    return connection;
  } catch (err) {
    console.error('Database connection error:', err);
    throw new Error('Failed to connect to Oracle database');
  }
}

/**
 * Execute query with automatic connection management
 * @param {string} sql - SQL query
 * @param {Array|Object} binds - Bind parameters
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (err) {
    console.error('Query execution error:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

/**
 * Ensure default "General Studies" course exists for orphaned Learning Outcomes
 * @returns {Promise<number>} course_id
 */
async function ensureDefaultCourse() {
  let connection;
  try {
    connection = await getConnection();
    
    // Check if default program exists
    let result = await connection.execute(
      `SELECT program_id FROM PROGRAM WHERE program_name = 'General Studies' AND ROWNUM = 1`
    );
    
    let programId;
    if (result.rows.length === 0) {
      // Create default program
      result = await connection.execute(
        `INSERT INTO PROGRAM (program_name, faculty, total_credits) 
         VALUES ('General Studies', 'General', 120) 
         RETURNING program_id INTO :id`,
        { id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      programId = result.outBinds.id[0];
    } else {
      programId = result.rows[0].PROGRAM_ID;
    }
    
    // Check if default course exists
    result = await connection.execute(
      `SELECT course_id FROM COURSE WHERE course_code = 'GEN000' AND ROWNUM = 1`
    );
    
    let courseId;
    if (result.rows.length === 0) {
      // Create default course
      result = await connection.execute(
        `INSERT INTO COURSE (course_code, course_name, credit_hours, course_type, program_id)
         VALUES ('GEN000', 'General Learning Outcomes', 0, 'Academic', :programId)
         RETURNING course_id INTO :id`,
        { 
          programId,
          id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } 
        }
      );
      courseId = result.outBinds.id[0];
    } else {
      courseId = result.rows[0].COURSE_ID;
    }
    
    return courseId;
  } catch (err) {
    console.error('Error ensuring default course:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

module.exports = {
  getConnection,
  executeQuery,
  ensureDefaultCourse
};