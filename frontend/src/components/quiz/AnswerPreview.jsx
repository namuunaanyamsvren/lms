const CHOICE_TYPES = new Set(['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'SINGLE_CHOICE', 'TRUE_FALSE']);

const optionLabel = (question, optionId) => {
  if (question.type === 'TRUE_FALSE') {
    return optionId === 'true' ? 'Үнэн' : optionId === 'false' ? 'Худал' : optionId;
  }
  return question.options?.find((o) => o.id === optionId)?.text || optionId;
};

// Renders a student's quiz answer as readable text instead of a raw JSON dump —
// answerJson shape depends on question.type (see ExamRunner.jsx for how it's written).
export default function AnswerPreview({ question, answerJson }) {
  let value;
  try {
    value = JSON.parse(answerJson);
  } catch {
    return <p className="text-sm text-slate-500 italic">Хариулт унших боломжгүй байна.</p>;
  }

  if (value == null || value === '') {
    return <p className="text-sm text-slate-400 italic">Хариулаагүй</p>;
  }

  if (CHOICE_TYPES.has(question.type)) {
    const selected = Array.isArray(value) ? value : [value];
    if (selected.length === 0) return <p className="text-sm text-slate-400 italic">Хариулаагүй</p>;
    return (
      <ul className="mt-1 space-y-1 text-sm text-slate-700">
        {selected.map((optionId) => (
          <li key={optionId} className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
            {optionLabel(question, optionId)}
          </li>
        ))}
      </ul>
    );
  }

  return <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{String(value)}</p>;
}
