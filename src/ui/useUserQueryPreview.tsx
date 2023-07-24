import React, { useEffect, useState } from 'react';
import { MAX_PREVIEW_LENGTH } from './MinionTaskComponent';

export function useUserQueryPreview(userQuery: string) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    const lines = userQuery.split('\n');
    let newPreview = lines[0].substring(0, MAX_PREVIEW_LENGTH);

    if (lines.length > 1 || lines[0].length > MAX_PREVIEW_LENGTH) {
      newPreview += '…';
    }

    setPreview(newPreview);
  }, [userQuery]);

  return preview;
}
