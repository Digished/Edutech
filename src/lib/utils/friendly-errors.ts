import { z } from 'zod';

// Convert a zod error into a single human-readable sentence.
// Falls back to a generic phrase rather than leaking shape names like
// "Too small: expected string to have >=1 characters".
export function friendlyZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return 'Some details are missing or invalid.';

  const path = issue.path.filter((p) => typeof p === 'string') as string[];
  const field = niceField(path[path.length - 1] ?? '');

  switch (issue.code) {
    case 'invalid_type':
      return field ? `Please enter ${field}.` : 'Some required details are missing.';
    case 'too_small': {
      const min = Number((issue as { minimum?: number }).minimum ?? 1);
      const t = (issue as { type?: string }).type;
      if (t === 'string') {
        if (min <= 1) {
          return field ? `Please enter ${field}.` : 'Please fill in all required fields.';
        }
        const which = path[path.length - 1] ?? '';
        if (which === 'password') return `Your password needs at least ${min} characters.`;
        return field ? `${capitalize(field)} needs at least ${min} characters.` : `That value needs at least ${min} characters.`;
      }
      if (t === 'array') {
        return field ? `Add at least ${min} ${field}.` : `Add at least ${min}.`;
      }
      return field ? `${capitalize(field)} must be at least ${min}.` : `Value must be at least ${min}.`;
    }
    case 'too_big': {
      const max = (issue as { maximum?: number }).maximum;
      const t = (issue as { type?: string }).type;
      if (t === 'string') {
        return field ? `${capitalize(field)} is too long (max ${max}).` : 'That value is too long.';
      }
      return field ? `${capitalize(field)} can be at most ${max}.` : `Value can be at most ${max}.`;
    }
    case 'invalid_format': {
      const fmt = (issue as { format?: string }).format;
      if (fmt === 'email') return 'Please enter a valid email address.';
      if (fmt === 'uuid')  return field ? `Please choose a valid ${field}.` : 'Please choose a valid option.';
      if (fmt === 'url')   return 'Please enter a valid link.';
      return field ? `${capitalize(field)} doesn't look right.` : 'That value doesn’t look right.';
    }
    case 'invalid_value':
      return field ? `Please choose a valid ${field}.` : 'Please choose a valid option.';
    case 'unrecognized_keys':
      return 'Some unexpected fields were sent.';
    case 'custom':
      return issue.message || (field ? `${capitalize(field)} is invalid.` : 'Some details are invalid.');
    default:
      return field ? `${capitalize(field)} is invalid.` : 'Some details are invalid.';
  }
}

function niceField(raw: string): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    email: 'your email',
    password: 'a password',
    full_name: 'your full name',
    name: 'a name',
    amount: 'an amount',
    bank_code: 'a bank',
    account_number: 'a 10-digit account number',
    bank_account_number: 'a 10-digit account number',
    payout_method_id: 'a saved bank account',
    question_text: 'the question',
    correct_answer: 'the correct answer',
    options: 'the options',
    course_id: 'a course',
    department_id: 'a department',
    faculty_id: 'a faculty',
    university_id: 'a university',
    school: 'your school',
    department: 'your department',
    faculty: 'your faculty',
    plan: 'a subscription plan',
    level: 'your level',
    semester: 'your semester',
    status: 'a status',
    reason: 'a reason',
    value_num: 'a number',
  };
  if (map[raw]) return map[raw];
  return raw.replace(/_/g, ' ');
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
