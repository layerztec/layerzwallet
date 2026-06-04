import React, { memo, useMemo } from 'react';

import { resolveNftImageUri } from '../../utils/nft-image-uri';

type NftImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  uri: string;
};

export const NftImage = memo(({ uri, alt = '', ...props }: NftImageProps) => {
  const src = useMemo(() => resolveNftImageUri(uri), [uri]);
  return <img src={src} alt={alt} {...props} />;
});

NftImage.displayName = 'NftImage';
