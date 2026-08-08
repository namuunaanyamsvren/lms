import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, HelpCircle, ArrowLeft } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AnswerPreview from '../../components/quiz/AnswerPreview';
import { resumeQuizAttempt } from '../../services/api';

const STATUS_LABELS = {
  SUBMITTED: 'Илгээгдсэн',
  UNDER_REVIEW: 'Багш дүгнэж байна',
  GRADED: 'Дүгнэгдсэн',
};

function QuestionResult({ question, index }) {
  const icon = question.isCorrect === true
    ? <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
    : question.isCorrect === false
      ? <XCircle className="text-rose-600 shrink-0" size={20} />
      : <HelpCircle className="text-amber-500 shrink-0" size={20} />;
  return (
    <article className="panel">
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <p className="text-xs text-slate-500">Асуулт {index + 1} · {question.points} оноо{question.score != null ? ` · Авсан: ${question.score}` : ''}</p>
          <h3 className="font-medium mt-1">{question.text}</h3>
          <div className="mt-2">
            <p className="text-xs font-semibold text-slate-500">Таны хариулт</p>
            <AnswerPreview question={question} answerJson={JSON.stringify(question.studentAnswer)} />
          </div>
          {question.isCorrect === false && question.correctAnswer != null && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-emerald-700">Зөв хариулт</p>
              <AnswerPreview question={question} answerJson={JSON.stringify(question.correctAnswer)} />
            </div>
          )}
          {question.isCorrect == null && question.score == null && (
            <p className="mt-2 text-xs text-amber-700">Энэ асуултыг багш гараар дүгнэнэ.</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function QuizResult() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    resumeQuizAttempt(attemptId).then(setAttempt).catch(setError);
  }, [attemptId]);

  if (error) return <p role="alert">Үр дүнг ачаалахад алдаа гарлаа.</p>;
  if (!attempt) return <p role="status">Ачааллаж байна...</p>;

  if (attempt.status === 'IN_PROGRESS') {
    return (
      <div className="space-y-4">
        <PageHeader title={attempt.quiz.title} subtitle="Энэ оролдлого дуусаагүй байна." />
        <Link className="btn-primary inline-flex" to={`/student/exams/${attempt.id}`}>Шалгалтаа үргэлжлүүлэх</Link>
      </div>
    );
  }

  const showResults = attempt.quiz.showResults;

  return (
    <main className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title={attempt.quiz.title}
        subtitle={`Оролдлого #${attempt.attemptNumber} · ${STATUS_LABELS[attempt.status] || attempt.status}`}
        right={<Link className="btn inline-flex items-center gap-1.5" to="/student/quizzes"><ArrowLeft size={15} />Шалгалтууд руу буцах</Link>}
      />

      {!showResults ? (
        <section className="panel">
          <p className="text-sm text-slate-600">Шалгалт амжилттай илгээгдлээ. Энэ шалгалтын дүн, зөв хариултыг багш нээгээгүй байна.</p>
        </section>
      ) : (
        <>
          <section className="panel grid sm:grid-cols-3 gap-3 text-center">
            <div>
              <b className="text-2xl">{attempt.score == null ? '–' : `${Math.round(attempt.score)}%`}</b>
              <p className="text-sm text-slate-500">Нийт оноо</p>
            </div>
            <div>
              <b className={`text-2xl ${attempt.passed === true ? 'text-emerald-600' : attempt.passed === false ? 'text-rose-600' : 'text-slate-400'}`}>
                {attempt.passed == null ? 'Хүлээгдэж байна' : attempt.passed ? 'Тэнцсэн' : 'Тэнцээгүй'}
              </b>
              <p className="text-sm text-slate-500">Үр дүн</p>
            </div>
            <div>
              <b className="text-2xl">{attempt.quiz.questions.length}</b>
              <p className="text-sm text-slate-500">Асуулт</p>
            </div>
          </section>
          <div className="space-y-3">
            {attempt.quiz.questions.map((q, i) => <QuestionResult key={q.id} question={q} index={i} />)}
          </div>
        </>
      )}
    </main>
  );
}
