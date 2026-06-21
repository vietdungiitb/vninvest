import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  items: React.ReactNode[];
  autoPlay?: boolean;
  interval?: number;
  showArrows?: boolean;
  showIndicators?: boolean;
  className?: string;
}

const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  ({ items, autoPlay = false, interval = 5000, showArrows = true, showIndicators = true, className, children, ...props }, ref) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isPlaying] = React.useState(autoPlay);

    React.useEffect(() => {
      if (!isPlaying || items.length <= 1) return;
      const timer = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
      }, interval);
      return () => clearInterval(timer);
    }, [isPlaying, interval, items.length]);

    const goToPrevious = () => setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
    const goToNext = () => setCurrentIndex(prev => (prev + 1) % items.length);
    const goToSlide = (index: number) => setCurrentIndex(index);

    return (
      <div ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {items.map((item, index) => (
            <div key={index} className="flex-shrink-0 w-full" style={{ width: '100%' }}>
              {item}
            </div>
          ))}
        </div>

        {showArrows && items.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 z-10"
              onClick={goToPrevious}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 z-10"
              onClick={goToNext}
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {showIndicators && items.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {items.map((_, index) => (
              <button
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === currentIndex ? 'bg-slate-100' : 'bg-slate-500 hover:bg-slate-300'
                )}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
Carousel.displayName = 'Carousel';

const CarouselContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('overflow-hidden', className)} {...props}>{children}</div>
);
CarouselContent.displayName = 'CarouselContent';

const CarouselItem = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex h-[200px] w-full items-center justify-center rounded-md bg-slate-800', className)} {...props}>
    {children}
  </div>
);
CarouselItem.displayName = 'CarouselItem';

const CarouselPrevious = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cn('absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400', className)} {...props}>
    {children || <ChevronLeft className="h-5 w-5" />}
    <span className="sr-only">Previous</span>
  </button>
);
CarouselPrevious.displayName = 'CarouselPrevious';

const CarouselNext = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cn('absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400', className)} {...props}>
    {children || <ChevronRight className="h-5 w-5" />}
    <span className="sr-only">Next</span>
  </button>
);
CarouselNext.displayName = 'CarouselNext';

export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext };