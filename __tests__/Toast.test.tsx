import { render, act } from '@testing-library/react-native';
import { Toast } from '../src/components/Toast';

jest.useFakeTimers();

describe('Toast', () => {
  it('renders title and subtitle by variant', () => {
    const { getByText } = render(
      <Toast visible variant="warning" title="Cảnh báo" subtitle="Chi tiết" onClose={() => {}} />
    );
    expect(getByText('Cảnh báo')).toBeTruthy();
    expect(getByText('Chi tiết')).toBeTruthy();
  });

  it('auto-closes after 3 seconds', () => {
    const onClose = jest.fn();
    render(<Toast visible variant="success" title="OK" onClose={onClose} />);
    act(() => {
      jest.advanceTimersByTime(3400);
    });
    expect(onClose).toHaveBeenCalled();
  });
});
