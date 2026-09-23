import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface BookingEngineQuestion {
  id: string;
  question_key: string;
  label: string;
  description: string | null;
  input_type: string;
  required: boolean;
  display_order: number;
  options: unknown;
}

interface BookingEngineQuestionFieldsProps {
  questions: BookingEngineQuestion[];
  answers: Record<string, unknown>;
  onAnswerChange: (questionKey: string, value: unknown) => void;
}

function getOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];

  return options.filter(
    (option): option is string => typeof option === 'string'
  );
}

export default function BookingEngineQuestionFields({
  questions,
  answers,
  onAnswerChange,
}: BookingEngineQuestionFieldsProps) {
  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="font-medium">No additional details required</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This service does not have any additional questions configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map(question => {
        const value = answers[question.question_key];
        const options = getOptions(question.options);

        return (
          <div key={question.id} className="space-y-2">
            <Label>
              {question.label}
              {question.required ? (
                <span className="ml-1 text-destructive">*</span>
              ) : null}
            </Label>

            {question.description ? (
              <p className="text-sm text-muted-foreground">
                {question.description}
              </p>
            ) : null}

            {question.input_type === 'text' && (
              <Input
                value={typeof value === 'string' ? value : ''}
                onChange={event =>
                  onAnswerChange(question.question_key, event.target.value)
                }
              />
            )}

            {question.input_type === 'number' && (
              <Input
                type="number"
                value={value === undefined || value === null ? '' : String(value)}
                onChange={event =>
                  onAnswerChange(
                    question.question_key,
                    event.target.value === '' ? '' : Number(event.target.value)
                  )
                }
              />
            )}

            {question.input_type === 'select' && (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={typeof value === 'string' ? value : ''}
                onChange={event =>
                  onAnswerChange(question.question_key, event.target.value)
                }
              >
                <option value="">Select an option</option>
                {options.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {question.input_type === 'multi_select' && (
              <div className="space-y-2 rounded-md border p-3">
                {options.map(option => {
                  const selected = Array.isArray(value)
                    ? value.includes(option)
                    : false;

                  return (
                    <label
                      key={option}
                      className="flex items-center gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={event => {
                          const current = Array.isArray(value) ? value : [];

                          onAnswerChange(
                            question.question_key,
                            event.target.checked
                              ? [...current, option]
                              : current.filter(item => item !== option)
                          );
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {question.input_type === 'boolean' && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={question.question_key}
                    checked={value === true}
                    onChange={() =>
                      onAnswerChange(question.question_key, true)
                    }
                  />
                  Yes
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={question.question_key}
                    checked={value === false}
                    onChange={() =>
                      onAnswerChange(question.question_key, false)
                    }
                  />
                  No
                </label>
              </div>
            )}

            {question.input_type === 'date' && (
              <Input
                type="date"
                value={typeof value === 'string' ? value : ''}
                onChange={event =>
                  onAnswerChange(question.question_key, event.target.value)
                }
              />
            )}

            {question.input_type === 'time' && (
              <Input
                type="time"
                value={typeof value === 'string' ? value : ''}
                onChange={event =>
                  onAnswerChange(question.question_key, event.target.value)
                }
              />
            )}

            {question.input_type === 'measurement' && (
              <Input
                type="number"
                min="0"
                value={value === undefined || value === null ? '' : String(value)}
                onChange={event =>
                  onAnswerChange(
                    question.question_key,
                    event.target.value === '' ? '' : Number(event.target.value)
                  )
                }
                placeholder="Enter measurement"
              />
            )}

            {question.input_type === 'address' && (
              <Textarea
                rows={3}
                value={typeof value === 'string' ? value : ''}
                onChange={event =>
                  onAnswerChange(question.question_key, event.target.value)
                }
                placeholder="Enter the address"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
