import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Banner from '../components/Banner';
import TrendingGames from '../components/TrendingGames';
import MultiplayerGames from '../components/MultiplayerGames';
import PopularGames from '../components/PopularGames';
import Navbar from '../components/Navbar';
import SpinWheelScreen from '../components/SpinWheelScreen';
import BackgroundBubbles from '../components/BackgroundBubbles';
import BackgroundCircles from '../components/BackgroundCircles';
import SpinIcon from '../assets/SpinIcon.png';
import SteppedDivider from '../components/SteppedDivider';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const [showSpinWheel, setShowSpinWheel] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem('spinShownAfterLogin');
    if (!alreadyShown) {
      const timer = setTimeout(() => {
        setShowSpinWheel(true);
        sessionStorage.setItem('spinShownAfterLogin', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  //sound effect added
useEffect(() => {
  const alreadyPlayed = sessionStorage.getItem('homeIntroSoundPlayed');

  if (!alreadyPlayed) {
    const playIntroSound = () => {
      window.dispatchEvent(new CustomEvent("play-sound", { detail: "pop" }));
      sessionStorage.setItem('homeIntroSoundPlayed', 'true');

      // Remove listener after first interaction
      window.removeEventListener('click', playIntroSound);
      window.removeEventListener('touchstart', playIntroSound);
    };

    // Add event listener for first user interaction
    window.addEventListener('click', playIntroSound);
    window.addEventListener('touchstart', playIntroSound);

    // Cleanup in case component unmounts before interaction
    return () => {
      window.removeEventListener('click', playIntroSound);
      window.removeEventListener('touchstart', playIntroSound);
    };
  }
}, []);


  const handleCloseSpin = () => {
    setShowSpinWheel(false);
  };

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden text-white">
      {/* Background visuals */}
      <BackgroundBubbles />
      <BackgroundCircles />
      <div className="absolute inset-0 bg-gradient-to-b from-[#00bfff] to-[#000080] opacity-40 z-0" />

      <div className="relative z-10 pt-8">
        <Header />

        {/* Banner */}
        <div className="px-3">
          <Banner />
        </div>

        {/* Spin Button */}
        <div className="fixed bottom-16 right-0 z-20">
          <button
            onClick={() => setShowSpinWheel(true)}
            className="p-2 focus:outline-none"
          >
            <img
              src={SpinIcon}
              alt="Spin Wheel"
              className="w-14 h-14 hover:scale-110 transition-transform duration-200"
            />
          </button>
        </div>

        {/* Content Sections */}
        <div className="w-full">
          <div className="max-w-screen-lg mx-auto px-0">
            <TrendingGames />
            <SteppedDivider className="my-6" thickness="4" />
            <MultiplayerGames />
            <SteppedDivider className="my-6" thickness="4" />
            <PopularGames />
          </div>
        </div>
      </div>

      <Navbar />

      {showSpinWheel && (
        <SpinWheelScreen onClose={handleCloseSpin} isVisible={showSpinWheel} />
      )}
    </div>
  );
};

export default Home;
