import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SimpleButton from '../../shared/components/SimpleButton';

describe('SimpleButton Component', () => {
  // Test rendering
  test('renders correctly with default props', () => {
    const { getByText } = render(<SimpleButton>Test Button</SimpleButton>);
    expect(getByText('Test Button')).toBeTruthy();
  });

  // Test variants
  test('renders different variants', () => {
    const { getByText, rerender } = render(<SimpleButton variant="primary">Primary</SimpleButton>);
    expect(getByText('Primary')).toBeTruthy();

    rerender(<SimpleButton variant="secondary">Secondary</SimpleButton>);
    expect(getByText('Secondary')).toBeTruthy();

    rerender(<SimpleButton variant="danger">Danger</SimpleButton>);
    expect(getByText('Danger')).toBeTruthy();

    rerender(<SimpleButton variant="outline">Outline</SimpleButton>);
    expect(getByText('Outline')).toBeTruthy();
  });

  // Test sizes
  test('renders different sizes', () => {
    const { getByText, rerender } = render(<SimpleButton size="small">Small</SimpleButton>);
    expect(getByText('Small')).toBeTruthy();

    rerender(<SimpleButton size="medium">Medium</SimpleButton>);
    expect(getByText('Medium')).toBeTruthy();

    rerender(<SimpleButton size="large">Large</SimpleButton>);
    expect(getByText('Large')).toBeTruthy();
  });

  // Test onPress handler
  test('calls onPress function when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(<SimpleButton onPress={onPressMock}>Clickable</SimpleButton>);

    fireEvent.press(getByText('Clickable'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  // Test disabled state
  test('does not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <SimpleButton onPress={onPressMock} disabled>
        Disabled
      </SimpleButton>
    );

    fireEvent.press(getByText('Disabled'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  // Test loading state
  test('displays correct loading state based on platform', () => {
    const { getByText, queryByText, UNSAFE_getByType, rerender } = render(<SimpleButton>Not Loading</SimpleButton>);
    expect(getByText('Not Loading')).toBeTruthy();

    rerender(<SimpleButton isLoading>Should Not Show</SimpleButton>);
    // Text should not be visible when loading
    expect(queryByText('Should Not Show')).toBeNull();

    // In React Native, we should have an ActivityIndicator
    try {
      // This might throw if Platform.OS is 'web' in the test environment
      const activityIndicator = UNSAFE_getByType('ActivityIndicator');
      expect(activityIndicator).toBeTruthy();
    } catch (e) {
      // If we're in 'web' mode for testing, we'd expect "Loading..." text instead
      expect(queryByText('Loading...')).toBeTruthy();
    }
  });

  // Test testID prop
  test('passes testID prop correctly', () => {
    const { getByTestId } = render(<SimpleButton testID="test-button">Button with TestID</SimpleButton>);
    expect(getByTestId('test-button')).toBeTruthy();
  });
});
