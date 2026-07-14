import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Thumbs, Pagination, Zoom } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import 'swiper/css/pagination';
import 'swiper/css/zoom';
import './ProductDetail.css';

function getMediaTypeFromUrl(url) {
    const value = String(url || '').toLowerCase();
    if (/^data:video\//.test(value)) return 'video';
    if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(value)) return 'video';
    return 'image';
}

const ImageSlider = ({ images, mediaItems, productName }) => {
    const [thumbsSwiper, setThumbsSwiper] = useState(null);
    const normalizedMedia = Array.isArray(mediaItems) && mediaItems.length
        ? mediaItems
        : (Array.isArray(images) ? images.map(src => ({ type: getMediaTypeFromUrl(src), src })) : []);

    if (!normalizedMedia.length) {
        return (
            <div className="product-image-slider">
                <div className="product-main-image-fallback">
                    <img 
                        src="https://via.placeholder.com/600x600?text=No+Image" 
                        alt={productName}
                        className="product-slide-image"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="product-image-slider">
            <Swiper
                modules={[Navigation, Thumbs, Pagination, Zoom]}
                spaceBetween={10}
                slidesPerView={1}
                navigation={normalizedMedia.length > 1}
                pagination={normalizedMedia.length > 1 ? {
                    clickable: true,
                    dynamicBullets: true
                } : false}
                zoom={{
                    maxRatio: 2,
                    minRatio: 1
                }}
                thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
                className="product-main-swiper"
            >
                {normalizedMedia.map((item, index) => (
                    <SwiperSlide key={`main-${index}`}>
                        {item.type === 'video' ? (
                            <div className="product-video-container">
                                <video
                                    className="product-slide-video"
                                    controls
                                    preload="metadata"
                                >
                                    <source src={item.src} />
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        ) : (
                            <div className="swiper-zoom-container">
                                <img
                                    src={item.src}
                                    alt={`${productName} - View ${index + 1}`}
                                    className="product-slide-image"
                                    loading="lazy"
                                    onError={(e) => {
                                        console.error('Image failed to load:', item.src);
                                        e.target.src = 'https://via.placeholder.com/600x600?text=Image+Not+Found';
                                    }}
                                />
                            </div>
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
            
            {normalizedMedia.length > 1 && (
                <Swiper
                    onSwiper={setThumbsSwiper}
                    modules={[Navigation, Thumbs]}
                    spaceBetween={10}
                    slidesPerView={4}
                    freeMode={true}
                    watchSlidesProgress={true}
                    className="product-thumbs-swiper"
                    breakpoints={{
                        320: {
                            slidesPerView: 3,
                            spaceBetween: 8
                        },
                        640: {
                            slidesPerView: 4,
                            spaceBetween: 10
                        },
                        768: {
                            slidesPerView: 5,
                            spaceBetween: 10
                        }
                    }}
                >
                    {normalizedMedia.map((item, index) => (
                        <SwiperSlide key={`thumb-${index}`}>
                            {item.type === 'video' ? (
                                <div className="product-thumb-video" aria-label={`${productName} video thumbnail ${index + 1}`}>
                                    <span className="product-thumb-video-icon">VIDEO</span>
                                </div>
                            ) : (
                                <img
                                    src={item.src}
                                    alt={`${productName} thumbnail ${index + 1}`}
                                    className="product-thumb-image"
                                    loading="lazy"
                                    onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/150x150?text=Image';
                                    }}
                                />
                            )}
                        </SwiperSlide>
                    ))}
                </Swiper>
            )}
        </div>
    );
};

export default ImageSlider;
