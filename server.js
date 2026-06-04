/**
 * LOCAL DEVELOPMENT SERVER
 * Run: node server.js
 * Open: http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));
app.use((req, _res, next) => {
  if (req.path.startsWith('/.netlify') || req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.autoCommit = true;

async function getConnection() {
  return await oracledb.getConnection({
    user: 'F228700',
    password: '228700',
    connectString: 'fsktmdbora.upm.edu.my:1521/FSKTM'
  });
}

async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    connection = await getConnection();
    return await connection.execute(sql, binds, options);
  } finally {
    if (connection) try { await connection.close(); } catch (e) { /* ignore */ }
  }
}

async function ensureDefaultCourse() {
  let connection;
  try {
    connection = await getConnection();
    let result = await connection.execute(
      `SELECT program_id FROM PROGRAM WHERE program_name = 'General Studies' AND ROWNUM = 1`
    );
    let programId;
    if (result.rows.length === 0) {
      result = await connection.execute(
        `INSERT INTO PROGRAM (program_name, faculty, total_credits)
         VALUES ('General Studies', 'General', 120) RETURNING program_id INTO :id`,
        { id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      programId = result.outBinds.id[0];
    } else { programId = result.rows[0].PROGRAM_ID; }

    result = await connection.execute(`SELECT course_id FROM COURSE WHERE course_code = 'GEN000' AND ROWNUM = 1`);
    let courseId;
    if (result.rows.length === 0) {
      result = await connection.execute(
        `INSERT INTO COURSE (course_code, course_name, credit_hours, course_type, program_id)
         VALUES ('GEN000', 'General Learning Outcomes', 0, 'Academic', :programId) RETURNING course_id INTO :id`,
        { programId, id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      courseId = result.outBinds.id[0];
    } else { courseId = result.rows[0].COURSE_ID; }
    return courseId;
  } finally {
    if (connection) try { await connection.close(); } catch (e) { /* ignore */ }
  }
}

const T = {
  courseTypeIn: x => ({Core:'Academic',Elective:'Elective',Academic:'Academic',Technical:'Technical'}[x] || 'Academic'),
  courseTypeOut: x => ({Academic:'Core',Technical:'Core',Elective:'Elective'}[x] || 'Core'),
  statusIn: x => ({'In Progress':'Active',Completed:'Completed',Active:'Active',Withdrawn:'Withdrawn'}[x] || 'Active'),
  statusOut: x => ({Active:'In Progress',Completed:'Completed',Withdrawn:'Withdrawn'}[x] || 'In Progress'),
  knowledgeIn: x => ({Hard:'Academic Knowledge',Soft:'Technical Skills',Professional:'Marketability Values','Academic Knowledge':'Academic Knowledge','Technical Skills':'Technical Skills','Marketability Values':'Marketability Values'}[x] || 'Academic Knowledge'),
  knowledgeOut: x => ({'Academic Knowledge':'Hard','Technical Skills':'Soft','Marketability Values':'Professional'}[x] || 'Hard'),
  skillTypeIn: x => ({Cognitive:'Academic Knowledge','Soft Skill':'Technical Skills',Professional:'Marketability Values','Academic Knowledge':'Academic Knowledge','Technical Skills':'Technical Skills','Marketability Values':'Marketability Values'}[x] || 'Academic Knowledge'),
  skillTypeOut: x => ({'Academic Knowledge':'Cognitive','Technical Skills':'Soft Skill','Marketability Values':'Professional'}[x] || 'Cognitive'),
  strengthIn: x => { const n = parseFloat(x); if(isNaN(n)) return ['Low','Medium','High'].includes(x) ? x : 'Medium'; if(n<0.4) return 'Low'; if(n<0.7) return 'Medium'; return 'High'; },
  strengthOut: x => ({Low:0.3,Medium:0.6,High:0.9}[x] ?? 0.6),
  domainIn: x => ({Academic:'Knowledge','Co-curricular':'Skills',Knowledge:'Knowledge',Skills:'Skills',Values:'Values'}[x] || 'Knowledge'),
  domainOut: x => ({Knowledge:'Academic',Skills:'Co-curricular',Values:'Co-curricular'}[x] || 'Academic'),
  creditBearingIn: x => (x===true || x==='true' || x===1) ? 1 : 0,
  creditBearingOut: x => x===1 || x==='1',
  achievementIn: x => (typeof x === 'number' ? x.toString() : (x || '0')),
  achievementOut: x => { const n = parseFloat(x); return isNaN(n) ? 0 : n; }
};

function wrap(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (err) {
      console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
      res.status(500).json({ error: 'Server error', message: err.message });
    }
  };
}

// GET all data
app.get('/.netlify/functions/get-state', wrap(async (_req, res) => {
  const [programs, students, courses, los, skills, loMaps, cocs, ccMaps, enrs, scoc] = await Promise.all([
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
  res.json({
    meta: { version: 1, fetchedAt: new Date().toISOString() },
    programs: programs.rows.map(r => ({ program_id:String(r.PROGRAM_ID), program_name:r.PROGRAM_NAME, faculty:r.FACULTY, total_credits:r.TOTAL_CREDITS })),
    students: students.rows.map(r => ({ student_id:String(r.STUDENT_ID), matric_no:r.MATRIC_NO, full_name:r.FULL_NAME, email:r.EMAIL, program_id:String(r.PROGRAM_ID) })),
    courses: courses.rows.map(r => ({ course_id:String(r.COURSE_ID), course_code:r.COURSE_CODE, course_name:r.COURSE_NAME, course_type:T.courseTypeOut(r.COURSE_TYPE), credit_hours:r.CREDIT_HOURS, program_id:String(r.PROGRAM_ID) })),
    learningOutcomes: los.rows.map(r => ({ lo_id:String(r.LO_ID), lo_code:r.LO_CODE, description:r.DESCRIPTION, domain:T.domainOut(r.DOMAIN), course_id:String(r.COURSE_ID) })),
    employabilitySkills: skills.rows.map(r => ({ skill_id:String(r.SKILL_ID), skill_name:r.SKILL_NAME, skill_type:T.skillTypeOut(r.SKILL_TYPE), description:r.DESCRIPTION || '' })),
    loSkillMappings: loMaps.rows.map(r => ({ mapping_id:String(r.MAPPING_ID), lo_id:String(r.LO_ID), skill_id:String(r.SKILL_ID), knowledge_type:T.knowledgeOut(r.KNOWLEDGE_TYPE), mapping_strength:T.strengthOut(r.MAPPING_STRENGTH) })),
    coCurriculum: cocs.rows.map(r => ({ cocurr_id:String(r.COCURR_ID), activity_name:r.ACTIVITY_NAME, organizer:r.ORGANIZER, category:r.CATEGORY, is_credit_bearing:T.creditBearingOut(r.IS_CREDIT_BEARING), credit_hours:r.CREDIT_HOURS })),
    coCurrSkillMappings: ccMaps.rows.map(r => ({ mapping_id:String(r.MAPPING_ID), cocurr_id:String(r.COCURR_ID), skill_id:String(r.SKILL_ID), knowledge_type:T.knowledgeOut(r.KNOWLEDGE_TYPE), mapping_strength:T.strengthOut(r.MAPPING_STRENGTH) })),
    enrollments: enrs.rows.map(r => ({ enrollment_id:String(r.ENROLLMENT_ID), student_id:String(r.STUDENT_ID), course_id:String(r.COURSE_ID), semester:r.SEMESTER, status:T.statusOut(r.STATUS), grade:r.GRADE || '' })),
    studentCoCurriculum: scoc.rows.map(r => ({ record_id:String(r.RECORD_ID), student_id:String(r.STUDENT_ID), cocurr_id:String(r.COCURR_ID), semester:r.SEMESTER, role:r.ROLE || '', achievement:T.achievementOut(r.ACHIEVEMENT) }))
  });
}));

app.post('/.netlify/functions/manage-programs', wrap(async (req, res) => {
  const { program_name, faculty, total_credits } = req.body;
  if (!program_name || !faculty) return res.status(400).json({ error: 'program_name and faculty required' });
  const result = await executeQuery(
    `INSERT INTO PROGRAM (program_name, faculty, total_credits) VALUES (:program_name, :faculty, :total_credits) RETURNING program_id INTO :id`,
    { program_name, faculty, total_credits: parseInt(total_credits) || 120, id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
  );
  res.status(201).json({ success: true, program_id: String(result.outBinds.id[0]) });
}));

app.post('/.netlify/functions/manage-students', wrap(async (req, res) => {
  const { full_name, matric_no, email, program_id } = req.body;
  if (!full_name || !matric_no || !email || !program_id) return res.status(400).json({ error: 'Missing required fields' });
  const result = await executeQuery(
    `INSERT INTO STUDENT (full_name, matric_no, email, program_id) VALUES (:full_name, :matric_no, :email, :program_id) RETURNING student_id INTO :id`,
    { full_name, matric_no, email, program_id: parseInt(program_id), id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
  );
  res.status(201).json({ success: true, student_id: String(result.outBinds.id[0]) });
}));

app.post('/.netlify/functions/manage-skills', wrap(async (req, res) => {
  const { skill_name, skill_type, description } = req.body;
  if (!skill_name || !skill_type) return res.status(400).json({ error: 'skill_name and skill_type required' });
  const result = await executeQuery(
    `INSERT INTO EMPLOYABILITY_SKILL (skill_name, skill_type, description) VALUES (:skill_name, :skill_type, :description) RETURNING skill_id INTO :id`,
    { skill_name, skill_type: T.skillTypeIn(skill_type), description: description || null, id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
  );
  res.status(201).json({ success: true, skill_id: String(result.outBinds.id[0]) });
}));

app.post('/.netlify/functions/manage-courses', wrap(async (req, res) => {
  const { course_id, course_code, course_name, course_type, credit_hours, program_id } = req.body;
  if (!course_code || !course_name || !program_id) return res.status(400).json({ error: 'Missing required fields' });
  const oracleCourseType = T.courseTypeIn(course_type || 'Core');
  if (course_id) {
    await executeQuery(
      `UPDATE COURSE SET course_code=:course_code, course_name=:course_name, course_type=:course_type, credit_hours=:credit_hours, program_id=:program_id WHERE course_id=:course_id`,
      { course_id: parseInt(course_id), course_code, course_name, course_type: oracleCourseType, credit_hours: parseInt(credit_hours) || 3, program_id: parseInt(program_id) }
    );
    return res.json({ success: true, course_id });
  }
  const result = await executeQuery(
    `INSERT INTO COURSE (course_code, course_name, course_type, credit_hours, program_id) VALUES (:course_code, :course_name, :course_type, :credit_hours, :program_id) RETURNING course_id INTO :id`,
    { course_code, course_name, course_type: oracleCourseType, credit_hours: parseInt(credit_hours) || 3, program_id: parseInt(program_id), id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
  );
  res.status(201).json({ success: true, course_id: String(result.outBinds.id[0]) });
}));

app.post('/.netlify/functions/manage-learning-outcomes', wrap(async (req, res) => {
  const { action, lo_id, lo_code, description, domain, course_id } = req.body;
  if (action === 'delete' && lo_id) {
    await executeQuery('DELETE FROM LEARNING_OUTCOME WHERE lo_id = :lo_id', { lo_id: parseInt(lo_id) });
    return res.json({ success: true });
  }
  if (!lo_code || !description) return res.status(400).json({ error: 'Missing required fields' });
  const finalCourseId = course_id ? parseInt(course_id) : await ensureDefaultCourse();
  if (lo_id) {
    await executeQuery(
      `UPDATE LEARNING_OUTCOME SET lo_code=:lo_code, description=:description, domain=:domain, course_id=:course_id WHERE lo_id=:lo_id`,
      { lo_id: parseInt(lo_id), lo_code, description, domain: T.domainIn(domain), course_id: finalCourseId }
    );
    return res.json({ success: true, lo_id });
  }
  const result = await executeQuery(
    `INSERT INTO LEARNING_OUTCOME (lo_code, description, domain, course_id) VALUES (:lo_code, :description, :domain, :course_id) RETURNING lo_id INTO :id`,
    { lo_code, description, domain: T.domainIn(domain || 'Academic'), course_id: finalCourseId, id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
  );
  res.status(201).json({ success: true, lo_id: String(result.outBinds.id[0]) });
}));

app.post('/.netlify/functions/manage-enrollments', wrap(async (req, res) => {
  const { action, enrollment_id, student_id, course_id, semester, status, grade } = req.body;
  if (action === 'delete' && enrollment_id) {
    await executeQuery('DELETE FROM ENROLLMENT WHERE enrollment_id = :enrollment_id', { enrollment_id: parseInt(enrollment_id) });
    return res.json({ success: true });
  }
  if (!student_id || !course_id || !semester) return res.status(400).json({ error: 'Missing required fields' });
  const result = await executeQuery(
    `INSERT INTO ENROLLMENT (student_id, course_id, semester, status, grade) VALUES (:student_id, :course_id, :semester, :status, :grade) RETURNING enrollment_id INTO :id`,
    { student_id: parseInt(student_id), course_id: parseInt(course_id), semester, status: T.statusIn(status || 'In Progress'), grade: grade || null, id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
  );
  res.status(201).json({ success: true, enrollment_id: String(result.outBinds.id[0]) });
}));

app.post('/.netlify/functions/manage-cocurriculum', wrap(async (req, res) => {
  const { type, action } = req.body;
  if (type === 'activity') {
    const { cocurr_id, activity_name, organizer, category, is_credit_bearing, credit_hours } = req.body;
    if (!activity_name || !organizer || !category) return res.status(400).json({ error: 'Missing required fields' });
    if (cocurr_id) {
      await executeQuery(
        `UPDATE CO_CURRICULUM SET activity_name=:activity_name, organizer=:organizer, category=:category, is_credit_bearing=:is_credit_bearing, credit_hours=:credit_hours WHERE cocurr_id=:cocurr_id`,
        { cocurr_id: parseInt(cocurr_id), activity_name, organizer, category, is_credit_bearing: T.creditBearingIn(is_credit_bearing), credit_hours: parseInt(credit_hours) || 0 }
      );
      return res.json({ success: true, cocurr_id });
    }
    const result = await executeQuery(
      `INSERT INTO CO_CURRICULUM (activity_name, organizer, category, is_credit_bearing, credit_hours) VALUES (:activity_name, :organizer, :category, :is_credit_bearing, :credit_hours) RETURNING cocurr_id INTO :id`,
      { activity_name, organizer, category, is_credit_bearing: T.creditBearingIn(is_credit_bearing), credit_hours: parseInt(credit_hours) || 0, id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
    );
    return res.status(201).json({ success: true, cocurr_id: String(result.outBinds.id[0]) });
  }
  if (type === 'skill-mapping') {
    if (action === 'delete') {
      await executeQuery('DELETE FROM COCURR_SKILL_MAPPING WHERE mapping_id = :mapping_id', { mapping_id: parseInt(req.body.mapping_id) });
      return res.json({ success: true });
    }
    const { cocurr_id, skill_id, knowledge_type, mapping_strength } = req.body;
    if (!cocurr_id || !skill_id) return res.status(400).json({ error: 'Missing required fields' });
    const result = await executeQuery(
      `INSERT INTO COCURR_SKILL_MAPPING (cocurr_id, skill_id, knowledge_type, mapping_strength) VALUES (:cocurr_id, :skill_id, :knowledge_type, :mapping_strength) RETURNING mapping_id INTO :id`,
      { cocurr_id: parseInt(cocurr_id), skill_id: parseInt(skill_id), knowledge_type: T.knowledgeIn(knowledge_type), mapping_strength: T.strengthIn(mapping_strength || 0.6), id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
    );
    return res.status(201).json({ success: true, mapping_id: String(result.outBinds.id[0]) });
  }
  if (type === 'participation') {
    if (action === 'delete') {
      await executeQuery('DELETE FROM STUDENT_COCURRICULUM WHERE record_id = :record_id', { record_id: parseInt(req.body.record_id) });
      return res.json({ success: true });
    }
    const { student_id, cocurr_id, semester, role, achievement } = req.body;
    if (!student_id || !cocurr_id || !semester || !role) return res.status(400).json({ error: 'Missing required fields' });
    const result = await executeQuery(
      `INSERT INTO STUDENT_COCURRICULUM (student_id, cocurr_id, semester, role, achievement) VALUES (:student_id, :cocurr_id, :semester, :role, :achievement) RETURNING record_id INTO :id`,
      { student_id: parseInt(student_id), cocurr_id: parseInt(cocurr_id), semester, role, achievement: T.achievementIn(achievement), id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
    );
    return res.status(201).json({ success: true, record_id: String(result.outBinds.id[0]) });
  }
  res.status(400).json({ error: 'Invalid request type' });
}));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

async function start() {
  console.log('\n========================================');
  console.log(' CCS3402 Marketability — Local Server');
  console.log('========================================\n');
  console.log('Testing Oracle connection...');
  try {
    const conn = await getConnection();
    await conn.execute('SELECT 1 FROM DUAL');
    await conn.close();
    console.log('✅ Oracle connection: OK\n');
  } catch (err) {
    console.error('❌ Oracle connection FAILED:');
    console.error('   ' + err.message);
    console.error('\nCheck your .env file:');
    console.error('   ORACLE_USER=' + (process.env.ORACLE_USER || '(not set)'));
    console.error('   ORACLE_PASSWORD=' + (process.env.ORACLE_PASSWORD ? '(set)' : '(not set)'));
    console.error('   ORACLE_CONN_STRING=' + (process.env.ORACLE_CONN_STRING || '(not set)'));
    console.error('\nServer will still start, but DB ops will fail.\n');
  }
  app.listen(PORT, () => {
    console.log(`✅ Server running at: http://localhost:${PORT}`);
    console.log(`   Open your browser there!\n`);
    console.log('Press Ctrl+C to stop.\n');
  });
}

start();

// Makes this file act as its own module wrapper to bypass VS Code scoping bugs
module.exports = {};
