#!/bin/bash
# Switch between different layout implementations

BACKUP_DIR="/Users/marcosrodriguez/layerzwallet/mobile/app/layout-backup"
APP_DIR="/Users/marcosrodriguez/layerzwallet/mobile/app"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to switch to a specific layout
switch_layout() {
  local layout_type="$1"
  
  echo "Switching to ${layout_type} layout..."
  
  # Backup current layout
  if [ -f "${APP_DIR}/_layout.tsx" ]; then
    cp "${APP_DIR}/_layout.tsx" "${BACKUP_DIR}/_layout.tsx.bak"
    echo "Current layout backed up to ${BACKUP_DIR}/_layout.tsx.bak"
  fi
  
  # Copy the selected layout
  cp "${APP_DIR}/_${layout_type}.tsx" "${APP_DIR}/_layout.tsx"
  
  echo "Layout switched to ${layout_type} successfully!"
}

# Show usage
if [ "$1" = "" ]; then
  echo "Usage: $0 [failsafe|minimal|original]"
  echo "  failsafe  - Use the ultra-minimal failsafe layout"
  echo "  minimal   - Use the minimal layout"
  echo "  original  - Restore the original layout (if available in backup)"
  exit 1
fi

# Switch based on argument
if [ "$1" = "failsafe" ]; then
  switch_layout "failsafe"
elif [ "$1" = "minimal" ]; then
  switch_layout "minimal"
elif [ "$1" = "original" ]; then
  # Restore original from backup
  if [ -f "${BACKUP_DIR}/_layout.tsx.bak" ]; then
    cp "${BACKUP_DIR}/_layout.tsx.bak" "${APP_DIR}/_layout.tsx"
    echo "Restored original layout from backup."
  else
    echo "Error: No backup layout found!"
    exit 1
  fi
else
  echo "Unknown layout type: $1"
  echo "Use: failsafe, minimal, or original"
  exit 1
fi

echo "Layout switch complete. Restart the app to see changes."
