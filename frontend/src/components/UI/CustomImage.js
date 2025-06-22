import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getCardImageUrl } from '@/utils/imageUtils';

const CustomImage = ({
  card,
  src,
  alt,
  width = 0, // Default to 0 to allow fill prop to take over
  height = 0, // Default to 0 to allow fill prop to take over
  className = '',
  priority = false,
  fill = true, // Default to fill to maintain aspect ratio
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState('');
  const [imageError, setImageError] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  // Handle image source and error states
  useEffect(() => {
    if (!card && !src) {
      setImageError(true);
      return;
    }

    // If src is provided directly, use it
    if (src) {
      // Handle static images (like placeholders)
      if (typeof src === 'string' && src.startsWith('/')) {
        setImageSrc(src);
        return;
      }
      
      setImageSrc(src);
      return;
    }

    // Otherwise, try to get the image URL from the card object
    try {
      const imageUrl = getCardImageUrl(card.tcgImageUrl || card.image, {
        cardName: card.tcgName || card.name,
        cardId: card.cardId,
        debug: process.env.NODE_ENV === 'development',
        fallbackReason: 'No image source available'
      });
      setImageSrc(imageUrl);
    } catch (error) {
      console.error('Error getting image URL:', error);
      setImageError(true);
    }
  }, [card, src]);

  // Handle container resize to maintain aspect ratio
  useEffect(() => {
    if (!containerRef.current || !fill) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: containerWidth,
          height: containerHeight
        });
      }
    };

    // Initial update
    updateDimensions();

    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [fill]);

  // Calculate aspect ratio for the image
  const aspectRatio = dimensions.width && dimensions.height ? dimensions.width / dimensions.height : 1;

  // Handle image error
  const handleError = (e) => {
    console.error('Failed to load image:', {
      src: imageSrc,
      cardId: card?.cardId,
      error: e
    });
    setImageError(true);
  };

  // If there's an error or no source, show placeholder
  if (imageError || !imageSrc) {
    return (
      <div 
        ref={containerRef}
        className={`relative ${className}`} 
        style={{ 
          width: width || '100%',
          height: height || '100%',
          aspectRatio: aspectRatio ? undefined : '2/3' // Default aspect ratio for cards
        }}
      >
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 text-sm">No image</span>
        </div>
      </div>
    );
  }

  // For static images (like placeholders), use a regular img tag
  if (typeof imageSrc === 'string' && imageSrc.startsWith('/')) {
    return (
      <div 
        ref={containerRef}
        className={`relative ${className}`}
        style={{
          width: width || '100%',
          height: height || '100%',
          aspectRatio: aspectRatio ? undefined : '2/3' // Default aspect ratio for cards
        }}
      >
        <img
          src={imageSrc}
          alt={alt || card?.tcgName || card?.name || 'Card image'}
          className="w-full h-full object-contain"
          onError={handleError}
        />
      </div>
    );
  }

  // For remote images, use Next.js Image component
  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        width: width || '100%',
        height: height || '100%',
        aspectRatio: aspectRatio ? undefined : '2/3' // Default aspect ratio for cards
      }}
    >
      <Image
        src={imageSrc}
        alt={alt || card?.tcgName || card?.name || 'Card image'}
        fill={fill}
        width={fill ? undefined : dimensions.width || width}
        height={fill ? undefined : dimensions.height || height}
        className="object-contain"
        priority={priority}
        unoptimized={process.env.NODE_ENV === 'development'}
        onError={handleError}
        {...props}
      />
    </div>
  );
};

export default CustomImage;
