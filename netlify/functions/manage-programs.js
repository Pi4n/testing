/**
 * Program Management - POST /api/manage-programs
 * Create new academic programs
 */

const { executeQuery } = require('./_shared/db');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { program_name, faculty, total_credits } = data;

    if (!program_name || !faculty) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'program_name and faculty are required' })
      };
    }

    const result = await executeQuery(
      `INSERT INTO PROGRAM (program_name, faculty, total_credits)
       VALUES (:program_name, :faculty, :total_credits)
       RETURNING program_id INTO :id`,
      {
        program_name,
        faculty,
        total_credits: parseInt(total_credits) || 120,
        id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
      }
    );

    const programId = result.outBinds.id[0];

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        program_id: String(programId),
        message: 'Program created successfully'
      })
    };

  } catch (error) {
    console.error('Error managing program:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create program',
        message: error.message
      })
    };
  }
};
