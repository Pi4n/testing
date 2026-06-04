/**
 * Universal State Fetcher - GET /api/get-state
 * Returns all data or specific tables from Oracle database
 * Transforms Oracle format to frontend format
 */

const { executeQuery } = require('./_shared/db');
const {
  transformCourseTypeFromOracle,
  transformStatusFromOracle,
  transformKnowledgeTypeFromOracle,
  transformSkillTypeFromOracle,
  transformMappingStrengthFromOracle,
  transformAchievementFromOracle,
  transformLODomainFromOracle,
  transformCreditBearingFromOracle
} = require('./_shared/transformers');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Fetch all data from all tables
    const [
      programsResult,
      studentsResult,
      coursesResult,
      learningOutcomesResult,
      skillsResult,
      loSkillMappingsResult,
      coCurriculumResult,
      coCurrSkillMappingsResult,
      enrollmentsResult,
      studentCoCurrResult
    ] = await Promise.all([
      executeQuery('SELECT * FROM PROGRAM ORDER BY program_id'),
      executeQuery('SELECT * FROM STUDENT ORDER BY student_id'),
      executeQuery('SELECT * FROM COURSE ORDER BY course_id'),
      executeQuery('SELECT * FROM LEARNING_OUTCOME ORDER BY lo_id'),
      executeQuery('SELECT * FROM EMPLOYABILITY_SKILL ORDER BY skill_id'),
      executeQuery('SELECT * FROM SKILL_MAPPING ORDER BY mapping_id'),
      executeQuery('SELECT * FROM CO_CURRICULUM ORDER BY cocurr_id'),
      executeQuery('SELECT * FROM COCURR_SKILL_MAPPING ORDER BY mapping_id'),
      executeQuery('SELECT * FROM ENROLLMENT ORDER BY enrollment_id'),
      executeQuery('SELECT * FROM STUDENT_COCURRICULUM ORDER BY record_id')
    ]);

    // Transform to frontend format
    const state = {
      meta: {
        version: 1,
        fetchedAt: new Date().toISOString()
      },
      programs: programsResult.rows.map(row => ({
        program_id: String(row.PROGRAM_ID),
        program_name: row.PROGRAM_NAME,
        faculty: row.FACULTY,
        total_credits: row.TOTAL_CREDITS
      })),
      students: studentsResult.rows.map(row => ({
        student_id: String(row.STUDENT_ID),
        matric_no: row.MATRIC_NO,
        full_name: row.FULL_NAME,
        email: row.EMAIL,
        program_id: String(row.PROGRAM_ID)
      })),
      courses: coursesResult.rows.map(row => ({
        course_id: String(row.COURSE_ID),
        course_code: row.COURSE_CODE,
        course_name: row.COURSE_NAME,
        course_type: transformCourseTypeFromOracle(row.COURSE_TYPE),
        credit_hours: row.CREDIT_HOURS,
        program_id: String(row.PROGRAM_ID)
      })),
      learningOutcomes: learningOutcomesResult.rows.map(row => ({
        lo_id: String(row.LO_ID),
        lo_code: row.LO_CODE,
        description: row.DESCRIPTION,
        domain: transformLODomainFromOracle(row.DOMAIN),
        course_id: String(row.COURSE_ID)
      })),
      employabilitySkills: skillsResult.rows.map(row => ({
        skill_id: String(row.SKILL_ID),
        skill_name: row.SKILL_NAME,
        skill_type: transformSkillTypeFromOracle(row.SKILL_TYPE),
        description: row.DESCRIPTION || ''
      })),
      loSkillMappings: loSkillMappingsResult.rows.map(row => ({
        mapping_id: String(row.MAPPING_ID),
        lo_id: String(row.LO_ID),
        skill_id: String(row.SKILL_ID),
        knowledge_type: transformKnowledgeTypeFromOracle(row.KNOWLEDGE_TYPE),
        mapping_strength: transformMappingStrengthFromOracle(row.MAPPING_STRENGTH)
      })),
      coCurriculum: coCurriculumResult.rows.map(row => ({
        cocurr_id: String(row.COCURR_ID),
        activity_name: row.ACTIVITY_NAME,
        organizer: row.ORGANIZER,
        category: row.CATEGORY,
        is_credit_bearing: transformCreditBearingFromOracle(row.IS_CREDIT_BEARING),
        credit_hours: row.CREDIT_HOURS
      })),
      coCurrSkillMappings: coCurrSkillMappingsResult.rows.map(row => ({
        mapping_id: String(row.MAPPING_ID),
        cocurr_id: String(row.COCURR_ID),
        skill_id: String(row.SKILL_ID),
        knowledge_type: transformKnowledgeTypeFromOracle(row.KNOWLEDGE_TYPE),
        mapping_strength: transformMappingStrengthFromOracle(row.MAPPING_STRENGTH)
      })),
      enrollments: enrollmentsResult.rows.map(row => ({
        enrollment_id: String(row.ENROLLMENT_ID),
        student_id: String(row.STUDENT_ID),
        course_id: String(row.COURSE_ID),
        semester: row.SEMESTER,
        status: transformStatusFromOracle(row.STATUS),
        grade: row.GRADE || ''
      })),
      studentCoCurriculum: studentCoCurrResult.rows.map(row => ({
        record_id: String(row.RECORD_ID),
        student_id: String(row.STUDENT_ID),
        cocurr_id: String(row.COCURR_ID),
        semester: row.SEMESTER,
        role: row.ROLE || '',
        achievement: transformAchievementFromOracle(row.ACHIEVEMENT)
      }))
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(state)
    };

  } catch (error) {
    console.error('Error fetching state:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch data',
        message: error.message 
      })
    };
  }
};
