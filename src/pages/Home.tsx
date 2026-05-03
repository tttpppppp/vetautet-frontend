import React from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import TicketList from '@/components/TicketList.tsx';
import ReasonsToBookSection from '@/components/ReasonsToBookSection';
import DestinationsSection from '@/components/DestinationsSection';
import PromotionSection from '@/components/PromotionSection';
import UpcomingDeparturesSection from '@/components/UpcomingDeparturesSection';
import Footer from '@/components/Footer';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

const Home: React.FC = () => {
    const { t } = useTranslation();

    return (
        <main className="min-h-screen bg-white">
            <Helmet>
                <title>{t('seo.home_title')}</title>
                <meta name="description" content={t('seo.home_desc')} />
            </Helmet>
            <h1 className="sr-only">{t('seo.sr_only_h1')}</h1>
            <Header />

            {/* Hero & Search Combined for Layout */}
            <HeroSection />

            {/* Ticket Listing */}
            <TicketList />

            {/* Explore Destinations */}
            <DestinationsSection />

            {/* Popular Routes */}
            <PromotionSection />

            {/* Upcoming Departures */}
            <UpcomingDeparturesSection />

            {/* Reasons to Book */}
            <ReasonsToBookSection />

            {/* Call to Action Section */}
            <section className="py-20 bg-tet-red relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                <div className="max-w-7xl mx-auto px-6 md:px-12 text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6">{t('home.cta_section.title')}</h2>
                    <p className="text-red-100 text-lg mb-10 max-w-2xl mx-auto font-medium">
                        {t('home.cta_section.desc')}
                    </p>
                    <button className="bg-tet-yellow hover:bg-white text-red-900 px-12 py-5 rounded-[2rem] font-black text-xl shadow-2xl transition-all transform hover:scale-105 active:scale-95">
                        {t('home.cta_section.button')}
                    </button>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default Home;
