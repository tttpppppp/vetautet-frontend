import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SearchForm from './SearchForm';

const HeroSection = () => {
    const { t } = useTranslation();

    return (
        <section className="relative pt-20 sm:pt-24 md:pt-28 lg:pt-32 pb-8 sm:pb-10 md:pb-12 lg:pb-16 w-full min-h-[calc(100svh-60px)] sm:min-h-0 flex items-center">
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `url('/chatgpt-banner.png')`,
                    backgroundPosition: 'center 30%',
                    backgroundSize: 'cover'
                }}
            />

            {/* Content Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full relative z-10">
                <div className="mb-5 sm:mb-6 md:mb-8 lg:mb-10 text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black mb-1 sm:mb-2 drop-shadow-lg leading-tight"
                    >
                        {t('hero.top_app')}
                    </motion.h1>
                </div>

                {/* Search Form Integration */}
                <div className="relative">
                    <SearchForm />
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
