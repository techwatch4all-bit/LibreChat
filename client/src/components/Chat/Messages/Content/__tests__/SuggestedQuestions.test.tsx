import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSubmitMessage = jest.fn();
jest.mock('~/hooks', () => ({
  useSubmitMessage: () => ({ submitMessage: mockSubmitMessage }),
}));

jest.mock('~/Providers', () => ({
  useChatFormContext: () => ({ setValue: jest.fn() }),
  useMessageContext: () => ({ isSubmitting: false }),
}));

import SuggestedQuestions from '../SuggestedQuestions';

describe('SuggestedQuestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when questions array is empty', () => {
    const { container } = render(<SuggestedQuestions questions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all suggested questions as clickable buttons', () => {
    const questions = [
      'What are the best formulation ratios for sensitive skin?',
      'Can this be combined with retinol?',
    ];
    render(<SuggestedQuestions questions={questions} />);

    expect(screen.getByText('Suggested Follow-up Questions')).toBeInTheDocument();
    expect(screen.getByText(questions[0])).toBeInTheDocument();
    expect(screen.getByText(questions[1])).toBeInTheDocument();
  });

  it('submits the prompt immediately when a question is clicked (click-and-go)', () => {
    const questions = ['What are the best formulation ratios for sensitive skin?'];
    render(<SuggestedQuestions questions={questions} />);

    const button = screen.getByRole('button', { name: new RegExp(questions[0], 'i') });
    fireEvent.click(button);

    expect(mockSubmitMessage).toHaveBeenCalledTimes(1);
    expect(mockSubmitMessage).toHaveBeenCalledWith({ text: questions[0] });
  });
});
