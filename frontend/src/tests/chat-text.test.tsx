import { render, screen } from '@testing-library/react'
import { ChatText } from '@/components/decide/ChatText'

describe('ChatText', () => {
  it('renders paragraphs, bullets and bold without interpreting other markup', () => {
    render(
      <ChatText
        text={'Amazon grew the most.\n\n- **Amazon**: 92.3%\n- Netflix: 12.1%\n\n<b>not html</b>'}
      />,
    )
    expect(screen.getByText('Amazon grew the most.')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Amazon').tagName).toBe('STRONG')
    expect(screen.getByText('<b>not html</b>')).toBeInTheDocument()
  })
})
