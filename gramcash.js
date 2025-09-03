import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';

// Define the global Firebase variables provided by the Canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Utility to generate a random user ID for anonymous login fallback
const generateUserId = () => `user-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

// Translation content
const translations = {
  en: {
    tagline: "Loans in Minutes, Trust for a Lifetime",
    welcomeTitle: "GramCash",
    welcomeButton: "Get Started",
    loginTitle: "Login or Sign Up",
    phonePlaceholder: "Enter Phone Number",
    sendOtp: "Send OTP",
    otpPlaceholder: "Enter OTP",
    verifyOtp: "Verify OTP",
    continueAsGuest: "Continue as Guest",
    chat1: "Namaste! I'm your loan assistant. Do you want a loan today?",
    yes: "Yes",
    no: "No",
    chat2: "Great! To check your loan eligibility, I need a few details. Please give me consent to collect your Aadhaar and PAN details.",
    giveConsent: "Give Consent",
    consentNote: "(This action simulates the collection of your data and starts the AI underwriting process.)",
    processing: "Processing your request...",
    processingNote: "Our AI is analyzing your profile to generate a personalized risk score. This may take a moment.",
    approvedTitle: "Loan Approved!",
    approvedChat: "Congratulations! Your loan has been approved. Here is your offer!",
    emi: "EMI",
    accept: "Accept with One Tap",
    rejectedTitle: "Loan Not Approved",
    rejectedChat: "Thank you for your interest. Unfortunately, based on our analysis, we cannot approve your loan at this time.",
    rejectedNote: "Please try again in 30 days or contact us for more information.",
    disbursedChat: "Your loan amount has been disbursed instantly to your linked UPI account. Thank you for using GramCash!",
    startOver: "Start Over",
    reasons: [
      "Insufficient income data",
      "No or little repayment history found",
      "Multiple pending loans detected"
    ],
  },
  hi: {
    tagline: "मिनटों में लोन, जीवन भर का विश्वास",
    welcomeTitle: "ग्रामकैश",
    welcomeButton: "शुरू करें",
    loginTitle: "लॉग इन या साइन अप करें",
    phonePlaceholder: "फ़ोन नंबर डालें",
    sendOtp: "ओटीपी भेजें",
    otpPlaceholder: "ओटीपी डालें",
    verifyOtp: "ओटीपी सत्यापित करें",
    continueAsGuest: "अतिथि के रूप में जारी रखें",
    chat1: "नमस्ते! मैं आपका लोन असिस्टेंट हूँ। क्या आपको आज लोन चाहिए?",
    yes: "हाँ",
    no: "नहीं",
    chat2: "बहुत बढ़िया! आपकी लोन योग्यता की जाँच करने के लिए, मुझे कुछ विवरण चाहिए। कृपया मुझे अपने आधार और पैन विवरण एकत्र करने की सहमति दें।",
    giveConsent: "सहमति दें",
    consentNote: "(यह कार्रवाई आपके डेटा के संग्रह का अनुकरण करती है और AI अंडरराइटिंग प्रक्रिया शुरू करती है।)",
    processing: "आपके अनुरोध को संसाधित किया जा रहा है...",
    processingNote: "हमारा AI आपकी प्रोफ़ाइल का विश्लेषण कर रहा है ताकि एक वैयक्तिकृत जोखिम स्कोर उत्पन्न हो सके। इसमें थोड़ा समय लग सकता है।",
    approvedTitle: "लोन स्वीकृत!",
    approvedChat: "बधाई हो! आपका लोन स्वीकृत हो गया है। यह रहा आपका प्रस्ताव!",
    emi: "ईएमआई",
    accept: "एक टैप से स्वीकार करें",
    rejectedTitle: "लोन स्वीकृत नहीं हुआ",
    rejectedChat: "आपकी रुचि के लिए धन्यवाद। दुर्भाग्यवश, हमारे विश्लेषण के आधार पर, हम इस समय आपके लोन को स्वीकृत नहीं कर सकते।",
    rejectedNote: "कृपया 30 दिनों में फिर से प्रयास करें या अधिक जानकारी के लिए हमसे संपर्क करें।",
    disbursedChat: "आपकी लोन राशि आपके लिंक किए गए यूपीआई खाते में तुरंत वितरित कर दी गई है। ग्रामकैश का उपयोग करने के लिए धन्यवाद!",
    startOver: "पुनः शुरू करें",
    reasons: [
      "आय के अपर्याप्त डेटा",
      "कोई या बहुत कम चुकौती इतिहास नहीं मिला",
      "कई लंबित लोन पाए गए"
    ],
  }
};

// Main App Component
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentStep, setCurrentStep] = useState('intro');
  const [language, setLanguage] = useState('en');
  const [loanOffer, setLoanOffer] = useState(null);
  const [isLoanProcessing, setIsLoanProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [isDataSaved, setIsDataSaved] = useState(false);
  
  const t = translations[language];

  // Initialize Firebase and handle authentication
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);
      setDb(firestore);
      setAuth(authInstance);

      const authenticate = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(authInstance, initialAuthToken);
          } else {
            await signInAnonymously(authInstance);
          }
          setUserId(authInstance.currentUser.uid);
        } catch (error) {
          console.error("Firebase auth failed:", error);
          // Fallback to a random ID if auth fails
          setUserId(generateUserId());
        } finally {
          setIsAuthReady(true);
        }
      };
      authenticate();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setIsAuthReady(true);
    }
  }, []);

  // Save the user's initial state to Firestore
  useEffect(() => {
    if (isAuthReady && db && userId && !isDataSaved) {
      const saveUserData = async () => {
        try {
          const userDocRef = doc(db, `/artifacts/${appId}/users/${userId}/loan-app-data`, 'user-profile');
          await setDoc(userDocRef, {
            appId,
            userId,
            startedAt: new Date(),
            status: 'started',
            language
          });
          setIsDataSaved(true);
          console.log("Initial user data saved to Firestore.");
        } catch (error) {
          console.error("Failed to save initial user data:", error);
        }
      };
      saveUserData();
    }
  }, [isAuthReady, db, userId, isDataSaved, language]);

  // Simulates the AI underwriting process
  const processLoan = async () => {
    setIsLoanProcessing(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate AI decision based on a random outcome
    const isApproved = Math.random() > 0.3; // 70% chance of approval for demo

    if (isApproved) {
      const amount = Math.floor(Math.random() * (50000 - 5000 + 1) + 5000);
      const emi = Math.floor(amount / 12);
      setLoanOffer({ amount, emi });
      setCurrentStep('approved');

      // Save the loan approval result to Firestore
      if (db && userId) {
        try {
          const loanDocRef = doc(db, `/artifacts/${appId}/users/${userId}/loan-app-data`, 'loan-decision');
          await setDoc(loanDocRef, {
            status: 'approved',
            amount,
            emi,
            decisionAt: new Date()
          }, { merge: true });
          console.log("Loan approval data saved to Firestore.");
        } catch (error) {
          console.error("Failed to save loan approval data:", error);
        }
      }
    } else {
      const reasons = translations[language].reasons;
      const randomReason = reasons[Math.floor(Math.random() * reasons.length)];
      setRejectionReason(randomReason);
      setCurrentStep('rejected');

      // Save the loan rejection result to Firestore
      if (db && userId) {
        try {
          const loanDocRef = doc(db, `/artifacts/${appId}/users/${userId}/loan-app-data`, 'loan-decision');
          await setDoc(loanDocRef, {
            status: 'rejected',
            reason: randomReason,
            decisionAt: new Date()
          }, { merge: true });
          console.log("Loan rejection data saved to Firestore.");
        } catch (error) {
          console.error("Failed to save loan rejection data:", error);
        }
      }
    }
    setIsLoanProcessing(false);
  };
  
  return (
    <div className="min-h-screen bg-[#3a5719] flex items-center justify-center p-4 font-sans">
      <style>{`
        body {
          background-color: #3a5719;
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-bubble {
          max-width: 80%;
          padding: 1.5rem;
          border-radius: 2rem;
          margin-bottom: 1rem;
          position: relative;
        }
        .left-bubble {
          border-bottom-left-radius: 0.5rem;
          align-self: flex-start;
        }
        .chat-button {
          padding: 1rem 2rem;
          font-weight: 600;
          color: white;
          border-radius: 9999px;
          transition: background-color 0.2s, transform 0.2s;
        }
        .chat-button:active {
          transform: scale(0.95);
        }
        .language-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 2.5rem;
          border-radius: 9999px;
          color: white;
          font-weight: 600;
          font-size: 1.25rem;
          transition: transform 0.2s, background-color 0.2s;
        }
        .language-button:hover {
          transform: scale(1.05);
        }
        .icon-bounce {
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
        {isLoanProcessing ? (
          <div className="flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="text-6xl text-lime-600 icon-bounce mb-4">
              <i className="fa-solid fa-spinner"></i>
            </div>
            <p className="text-xl font-semibold text-gray-800 text-center">
              {t.processing}
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">
              {t.processingNote}
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {currentStep === 'intro' && (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-28 w-28 text-white" fill="none" viewBox="0 0 512 512">
                    <path fill="currentColor" d="M166.7 186.2c.4-38.3 36.1-40.4 49.3-40.4h4.7c4.6 0 8.8 2.2 11.5 5.9l41.6 44.9 33.1-19.5c.7-.4 1.4-1.1 2.5-1.1s1.8.7 2.5 1.1l29.4 17.3c.7.4 1.4 1.1 2.5 1.1s1.8.7 2.5 1.1L405.3 194l4.5 10.9c.7 1.7 1.1 3.5 1.1 5.4l-.1 12.3c-.1 1.8-.4 3.7-.9 5.4l-44.5 91.5-85.1 41.5-12.8 1.4c-4.9.4-9.8-.1-14.2-1.6l-57.5-19.1c-4.9-1.6-9.2-4.5-12.6-8.5l-42.3-50.5c-3.1-3.7-5.1-8.1-5.9-12.8-2.6-13.7 2.4-28.7 13.9-38.6l7.8-6.6c11.5-9.9 26.5-14.8 40.1-12.2l5.4.9c5.1.9 9.8 3.5 13.5 7.4l-11.2 13.4zM245.9 203.2l20.8-19.8c8.9-8.5 21-12.8 33.3-12.8H428c11.9 0 21.6 9.7 21.6 21.6v23.2c0 24.5-19.9 44.4-44.4 44.4h-5.2l-36.2 34.6c-4.9 4.7-11.4 7-18.1 7.1h-44.8c-12.3 0-23.7-5.7-31.1-15.5l-21.6-28.2c-5.5-7.1-13.8-11.4-22.7-11.4H20c-11 0-20-9-20-20v-40c0-11 9-20 20-20h149.3c9.5 0 18.5 4 24.8 11.2l51.8 59.8z"/>
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#e58b02] -ml-16 mt-16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
                <h1 className="text-5xl font-extrabold text-white mb-2">{t.welcomeTitle}</h1>
                <p className="text-xl font-semibold text-white mb-8">
                  <span className="text-[#e58b02]">Loans</span> in Minutes, Trust for a Lifetime
                </p>
                <button
                  onClick={() => setCurrentStep('login')}
                  className="w-full bg-white text-[#3a5719] font-semibold py-4 px-6 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105"
                >
                  {t.welcomeButton}
                  <i className="fa-solid fa-arrow-right ml-2"></i>
                </button>
                <p className="text-gray-400 text-xs mt-4 break-all">
                  User ID: {userId || 'Authenticating...'}
                </p>
              </div>
            )}
            {currentStep === 'login' && (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#3a5719] rounded-3xl min-h-[400px]">
                <h2 className="text-3xl font-bold text-white mb-6">{t.loginTitle}</h2>
                <div className="w-full space-y-4 max-w-xs">
                  <input
                    type="tel"
                    placeholder={t.phonePlaceholder}
                    className="w-full p-4 rounded-full bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 transition"
                  />
                  <button className="w-full bg-lime-500 text-gray-900 font-semibold py-4 px-6 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105 hover:bg-lime-400">
                    {t.sendOtp}
                  </button>
                  <input
                    type="text"
                    placeholder={t.otpPlaceholder}
                    className="w-full p-4 rounded-full bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 transition"
                  />
                  <button className="w-full bg-lime-500 text-gray-900 font-semibold py-4 px-6 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105 hover:bg-lime-400">
                    {t.verifyOtp}
                  </button>
                  <button
                    onClick={() => setCurrentStep('language-select')}
                    className="w-full text-lime-300 font-semibold py-4 px-6 transition-transform duration-200 transform hover:scale-105"
                  >
                    {t.continueAsGuest}
                  </button>
                </div>
              </div>
            )}
            {currentStep === 'language-select' && (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#3a5719] rounded-3xl min-h-[400px]">
                <h1 className="text-4xl font-extrabold text-white mb-6">{t.welcomeTitle}</h1>
                <p className="text-xl text-gray-200 mb-8">Choose your language</p>
                <div className="flex flex-col space-y-4 w-full max-w-xs">
                  <button
                    onClick={() => { setLanguage('en'); setCurrentStep('start-loan'); }}
                    className="language-button bg-[#e58b02] hover:bg-orange-600"
                  >
                    English
                    <span className="text-2xl ml-2">🇮🇳</span>
                  </button>
                  <button
                    onClick={() => { setLanguage('hi'); setCurrentStep('start-loan'); }}
                    className="language-button bg-lime-500 hover:bg-lime-600"
                  >
                    हिंदी
                    <span className="text-2xl ml-2">🇮🇳</span>
                  </button>
                </div>
              </div>
            )}
            {currentStep === 'start-loan' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble bg-[#f3f4f6] border-l-4 border-[#3a5719]">
                  <div className="flex items-center">
                    <i className="fa-solid fa-user-gear text-2xl text-[#3a5719] mr-2"></i>
                    <p className="text-gray-800">{t.chat1}</p>
                  </div>
                </div>
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={() => setCurrentStep('collect-data')}
                    className="chat-button bg-[#e58b02] hover:bg-orange-600"
                  >
                    {t.yes} <i className="fa-solid fa-check ml-1"></i>
                  </button>
                  <button
                    className="chat-button bg-gray-300 text-gray-800 hover:bg-gray-400"
                  >
                    {t.no} <i className="fa-solid fa-xmark ml-1"></i>
                  </button>
                </div>
              </div>
            )}
            {currentStep === 'collect-data' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble bg-[#f3f4f6] border-l-4 border-blue-500">
                  <div className="flex items-center">
                    <i className="fa-solid fa-file-shield text-2xl text-blue-500 mr-2"></i>
                    <p className="text-gray-800">{t.chat2}</p>
                  </div>
                </div>
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={processLoan}
                    className="chat-button bg-[#e58b02] hover:bg-orange-600"
                  >
                    {t.giveConsent} <i className="fa-solid fa-fingerprint ml-1"></i>
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-4 text-center">
                  {t.consentNote}
                </p>
              </div>
            )}
            {currentStep === 'approved' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble bg-green-100 border-l-4 border-green-500">
                  <div className="flex items-center">
                    <i className="fa-solid fa-circle-check text-2xl text-green-500 mr-2"></i>
                    <p className="text-gray-800">{t.approvedChat}</p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-green-500 w-full max-w-sm mt-6 text-center">
                  <h3 className="text-2xl font-bold mb-2 text-green-700">{t.approvedTitle}</h3>
                  <p className="text-5xl font-extrabold text-gray-900 mb-2">
                    ₹{loanOffer.amount.toLocaleString('en-IN')}
                  </p>
                  <div className="flex items-center justify-center text-gray-600 mb-4 text-lg">
                    <i className="fa-solid fa-rupee-sign mr-2"></i>
                    <p className="font-semibold">{t.emi}: ₹{loanOffer.emi.toLocaleString('en-IN')}/month</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep('disbursed')}
                    className="w-full bg-[#e58b02] text-white font-semibold py-4 px-6 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105 hover:bg-orange-600"
                  >
                    {t.accept}
                  </button>
                </div>
              </div>
            )}
            {currentStep === 'rejected' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble bg-red-100 border-l-4 border-red-500">
                  <div className="flex items-center">
                    <i className="fa-solid fa-circle-xmark text-2xl text-red-500 mr-2"></i>
                    <p className="text-gray-800">{t.rejectedChat}</p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-red-500 w-full max-w-sm mt-6 text-center">
                  <h3 className="2xl font-bold mb-2 text-red-700">{t.rejectedTitle}</h3>
                  <p className="text-gray-600 mb-4 text-lg">Reason: {rejectionReason}</p>
                  <p className="text-sm text-gray-500">
                    {t.rejectedNote}
                  </p>
                </div>
              </div>
            )}
            {currentStep === 'disbursed' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble bg-green-100 border-l-4 border-green-500">
                  <div className="flex items-center">
                    <i className="fa-solid fa-money-bill-transfer text-2xl text-green-500 mr-2"></i>
                    <p className="text-gray-800">{t.disbursedChat}</p>
                  </div>
                </div>
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setCurrentStep('intro')}
                    className="w-full bg-[#e58b02] text-white font-semibold py-4 px-6 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105 hover:bg-orange-600 max-w-xs"
                  >
                    {t.startOver}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
