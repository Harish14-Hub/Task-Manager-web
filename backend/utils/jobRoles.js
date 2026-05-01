const JOB_ROLES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'QA Engineer',
  'UI/UX Designer',
  'DevOps Engineer',
  'Product Manager',
  'Business Analyst',
  'Support Engineer',
  'Team Member',
];

const normalizeRoleKey = (value = '') =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

const JOB_ROLE_LOOKUP = JOB_ROLES.reduce((map, role) => {
  map[normalizeRoleKey(role)] = role;
  return map;
}, {});

function normalizeJobRole(value) {
  return JOB_ROLE_LOOKUP[normalizeRoleKey(value)] || null;
}

module.exports = {
  JOB_ROLES,
  normalizeJobRole,
};
