import Joi from 'joi';

const MIN_YEAR = 1950;
const MAX_YEAR = 2200;

// ISO date string with a sane year range — catches typos like "0005-01-01" that would
// otherwise pass Joi's isoDate() check and blow up compound-interest calculations.
export const saneIsoDate = Joi.string().isoDate().custom((value: string, helpers) => {
  const year = parseInt(value.slice(0, 4), 10);
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return helpers.error('date.year');
  }
  return value;
}, 'sane year range').messages({
  'date.year': `"{#label}" must have a year between ${MIN_YEAR} and ${MAX_YEAR}`,
});
