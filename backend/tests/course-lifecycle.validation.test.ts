import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from '../academic-service/src/services/course.service';
import {
  courseBody,
  courseListQuery,
  lessonBody,
} from '../academic-service/src/validators/course.validator';

describe('course lifecycle validation', () => {
  it('applies safe paging defaults and bounds page size', () => {
    expect(courseListQuery.parse({})).toMatchObject({ page: 1, limit: 12 });
    expect(() => courseListQuery.parse({ limit: '101' })).toThrow();
  });

  it('validates lifecycle and completion configuration', () => {
    const parsed = courseBody.parse({
      code: 'CS-101',
      title: 'Computer Science',
      instructorId: '11111111-1111-4111-8111-111111111111',
      credits: 3,
      status: 'PUBLISHED',
      completionRule: 'PERCENTAGE',
      completionPercentage: 80,
    });
    expect(parsed.status).toBe('PUBLISHED');
    expect(() => courseBody.parse({ ...parsed, completionPercentage: 101 })).toThrow();
  });

  it('validates lesson content URLs and sanitizes rich text', () => {
    expect(() => lessonBody.parse({ title: 'Video', videoUrl: 'not-a-url' })).toThrow();
    const dirty =
      '<p onclick="steal()">Safe</p><script>alert(1)</script><a href="javascript:bad()">x</a>';
    const clean = sanitizeRichText(dirty)!;
    expect(clean).toContain('<p>Safe</p>');
    expect(clean).not.toMatch(/script|onclick|javascript:/i);
    const bypasses =
      '<iframe srcdoc="<script>alert(1)</script>"><svg><a xlink:href="javascript:alert(1)">x</a></svg><a href="java&#x73;cript:alert(1)">bad</a>';
    const hardened = sanitizeRichText(bypasses)!;
    expect(hardened).not.toMatch(/<(iframe|svg|script)/i);
    expect(hardened).not.toMatch(/<a[^>]+(?:xlink:href|href)=/i);
  });
});
