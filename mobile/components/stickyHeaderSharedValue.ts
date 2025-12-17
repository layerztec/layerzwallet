import { makeMutable, SharedValue } from 'react-native-reanimated';

// Shared scroll value used by StickyHeader when rendered outside of the Home screen tree
export const stickyHeaderScrollY: SharedValue<number> = makeMutable(0);
