import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResetLink,
  extractResetRouteFromLocation,
  isValidRawTokenFormat,
  validateEmailAddress,
  validatePasswordComplexity,
  validatePasswordResetPayload,
} from './passwordResetLogic';

describe('passwordResetLogic', () => {
  it('validates and normalizes email addresses', () => {
    const valid = validateEmailAddress('  Faculty.Name@BTEB.EDU.BD ');
    assert.equal(valid.valid, true);
    assert.equal(valid.email, 'faculty.name@bteb.edu.bd');

    assert.equal(validateEmailAddress('').valid, false);
    assert.equal(validateEmailAddress('bad..email@example.com').valid, false);
    assert.equal(validateEmailAddress('missing-domain@').valid, false);
  });

  it('enforces strict password complexity rules', () => {
    const tooShort = validatePasswordComplexity('Ab1!xyz');
    assert.equal(tooShort.valid, false);
    assert.ok(tooShort.errors.some(e => e.includes('at least 8 characters')));

    const noUpper = validatePasswordComplexity('lowercase1!');
    assert.equal(noUpper.valid, false);
    assert.ok(noUpper.errors.some(e => e.includes('uppercase')));

    const noLower = validatePasswordComplexity('UPPERCASE1!');
    assert.equal(noLower.valid, false);
    assert.ok(noLower.errors.some(e => e.includes('lowercase')));

    const noNumber = validatePasswordComplexity('NoDigitsHere!');
    assert.equal(noNumber.valid, false);
    assert.ok(noNumber.errors.some(e => e.includes('number')));

    const noSpecial = validatePasswordComplexity('NoSpecial123');
    assert.equal(noSpecial.valid, false);
    assert.ok(noSpecial.errors.some(e => e.includes('special')));

    const tooLong = validatePasswordComplexity('A1!'.repeat(30));
    assert.equal(tooLong.valid, false);
    assert.ok(tooLong.errors.some(e => e.includes('72')));

    const valid = validatePasswordComplexity('Presently#2026!');
    assert.equal(valid.valid, true);
    assert.equal(valid.errors.length, 0);
    assert.equal(valid.strengthScore, 5);
  });

  it('validates reset payloads and confirm_password matching', () => {
    const sampleToken = 'A'.repeat(43);
    assert.equal(isValidRawTokenFormat(sampleToken), true);
    assert.equal(isValidRawTokenFormat('short'), false);
    assert.equal(isValidRawTokenFormat('bad token with spaces ' + 'a'.repeat(30)), false);

    const mismatch = validatePasswordResetPayload({
      token: sampleToken,
      new_password: 'ValidPassword#1',
      confirm_password: 'ValidPassword#2',
    });
    assert.equal(mismatch.valid, false);
    assert.ok(mismatch.errors.some(e => e.includes('do not match')));

    const ok = validatePasswordResetPayload({
      token: sampleToken,
      new_password: 'ValidPassword#1',
      confirm_password: 'ValidPassword#1',
    });
    assert.equal(ok.valid, true);
    assert.equal(ok.token, sampleToken);
  });

  it('builds safe reset links and extracts route tokens', () => {
    const link = buildResetLink('https://portal.bteb.edu.bd/login', 'abc_123-XYZ');
    assert.equal(link, 'https://portal.bteb.edu.bd/reset-password?token=abc_123-XYZ');

    assert.throws(() => buildResetLink('javascript:alert(1)', 'token123'));

    const extracted = extractResetRouteFromLocation('/reset-password', '?token=xyz_987');
    assert.deepEqual(extracted, { isResetRoute: true, token: 'xyz_987' });

    const nonReset = extractResetRouteFromLocation('/', '?token=xyz_987');
    assert.deepEqual(nonReset, { isResetRoute: false, token: '' });
  });
});
