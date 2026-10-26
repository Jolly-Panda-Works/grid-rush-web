import { useEffect } from 'react';
import { useStore } from './store';
import { saveSettings } from './profile';
import LoadingScreen from './screens/LoadingScreen';
import SplashScreen from './screens/SplashScreen';
import ProfileScreen from './screens/ProfileScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import FriendsScreen from './screens/FriendsScreen';
import MenuScreen from './screens/MenuScreen';
import MatchmakingScreen from './screens/MatchmakingScreen';
import GameScreen from './screens/GameScreen';
import ResultsScreen from './screens/ResultsScreen';
import MuseumScreen from './screens/MuseumScreen';
import HowToPlay from './components/HowToPlay';
import { RotateOverlay } from './components/RotateOverlay';
import { SettingsModal } from './components/SettingsModal';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ServerNotice } from './components/ServerNotice';
import { AccountSwitchDialog, EmailLoginDialog, SaveReminder } from './components/AccountUI';
import { checkForUpdate } from './update';

export default function App() {
  const screen = useStore((s) => s.screen);
  const settings = useStore((s) => s.settings);
  const help = useStore((s) => s.showHelp);
  const settingsOpen = useStore((s) => s.showSettings);
  useEffect(() => { document.body.dataset.screen = screen; window.scrollTo(0, 0); }, [screen]); // the page itself never scrolls
  useEffect(() => { checkForUpdate(); }, []); // once per launch
  useEffect(() => {
    saveSettings(settings);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    document.documentElement.lang = settings.lang;
    document.documentElement.dir = settings.lang === 'fa' ? 'rtl' : 'ltr';
  }, [settings]);
  return (
    <>
      {screen === 'splash' && <SplashScreen />}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'menu' && <MenuScreen />}
      {screen === 'matchmaking' && <MatchmakingScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'results' && <ResultsScreen />}
      {screen === 'museum' && <MuseumScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'leaderboard' && <LeaderboardScreen />}
      {screen === 'friends' && <FriendsScreen />}
      {help && <HowToPlay />}
      {settingsOpen && <SettingsModal />}
      <UpdatePrompt />
      <ServerNotice />
      <EmailLoginDialog />
      <AccountSwitchDialog />
      <SaveReminder />
      <RotateOverlay />
    </>
  );
}
