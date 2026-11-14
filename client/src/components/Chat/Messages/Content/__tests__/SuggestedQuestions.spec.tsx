import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import SuggestedQuestions from '../SuggestedQuestions';

const mockSubmitMessage = jest.fn();
const mockSetValue = jest.fn();
const mockForceResize = jest.fn();

jest.mock('~/hooks', () => ({
  useSubmitMessage: () => ({ submitMessage: mockSubmitMessage }),
}));

jest.mock('~/Providers', () => ({
  useChatFormContext: () => ({ setValue: mockSetValue }),
  useMessageContext: () => ({ isSubmitting: false }),
}));

jest.mock('~/common', () => ({ mainTextareaId: 'prompt-textarea' }));

jest.mock('~/utils/textarea', () => ({
  forceResize: (...args: unknown[]) => mockForceResize(...(args as [])),
}));

const QUESTIONS = ['Why is the limit continuous at x = 0?', 'How does the chain rule apply here?'];

describe('SuggestedQuestions', () => {
  beforeEach(() => {
    mockSubmitMessage.mockClear();
    mockSetValue.mockClear();
  });

  test('renders one interactive chip per question in a two-column grid', () => {
    const { container } = render(<SuggestedQuestions questions={QUESTIONS} />);

    for (const question of QUESTIONS) {
      expect(screen.getByRole('button', { name: new RegExp(question) })).toBeInTheDocument();
    }
    expect(container.querySelector('.sm\\:grid-cols-2')).not.toBeNull();
  });

  test('submits the trimmed question text when a chip is clicked', async () => {
    const user = userEvent.setup();
    render(<SuggestedQuestions questions={['  How do I size the breaker?  ']} />);

    await user.click(screen.getByRole('button', { name: /How do I size the breaker/ }));

    expect(mockSubmitMessage).toHaveBeenCalledTimes(1);
    expect(mockSubmitMessage).toHaveBeenCalledWith({ text: 'How do I size the breaker?' });
  });

  test('stages the prompt in the composer textarea before submitting', async () => {
    const user = userEvent.setup();
    const textarea = document.createElement('textarea');
    textarea.id = 'prompt-textarea';
    document.body.appendChild(textarea);

    render(<SuggestedQuestions questions={QUESTIONS} />);
    await user.click(screen.getByRole('button', { name: new RegExp(QUESTIONS[0]) }));

    expect(textarea.value).toBe(QUESTIONS[0]);
    expect(mockSetValue).toHaveBeenCalledWith('text', QUESTIONS[0], {
      shouldDirty: true,
      shouldValidate: true,
    });
    expect(mockForceResize).toHaveBeenCalled();
    textarea.remove();
  });

  test('renders nothing when there are no questions', () => {
    const { container } = render(<SuggestedQuestions questions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
