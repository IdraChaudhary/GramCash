import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

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

// Utility to generate a random user ID for anonymous login fallback
const generateUserId = () => `user-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

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
          await signInAnonymously(authInstance);
          setUserId(authInstance.currentUser.uid);
        } catch (error) {
          console.error("Firebase auth failed:", error);
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
          const userDocRef = doc(db, 'users', userId);
          await setDoc(userDocRef, {
            userId,
            startedAt: new Date(),
            status: 'started',
            language,
            appVersion: '1.0.0'
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
          const loanDocRef = doc(db, 'loans', `${userId}-${Date.now()}`);
          await setDoc(loanDocRef, {
            userId,
            status: 'approved',
            amount,
            emi,
            decisionAt: new Date(),
            gramScore: Math.floor(Math.random() * (850 - 600 + 1) + 600)
          });
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
          const loanDocRef = doc(db, 'loans', `${userId}-${Date.now()}`);
          await setDoc(loanDocRef, {
            userId,
            status: 'rejected',
            reason: randomReason,
            decisionAt: new Date(),
            gramScore: Math.floor(Math.random() * (599 - 300 + 1) + 300)
          });
          console.log("Loan rejection data saved to Firestore.");
        } catch (error) {
          console.error("Failed to save loan rejection data:", error);
        }
      }
    }
    setIsLoanProcessing(false);
  };

  // Reset application to initial state
  const resetApplication = () => {
    setCurrentStep('intro');
    setLoanOffer(null);
    setRejectionReason(null);
    setIsDataSaved(false);
  };

  return (
    <div className="min-h-screen bg-[#3a5719] flex items-center justify-center p-4 font-sans">
      <style>{`
        body {
          background-color: #3a5719;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
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
          border: none;
          cursor: pointer;
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
          border: none;
          cursor: pointer;
          width: 100%;
          margin-bottom: 1rem;
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
        .input-field {
          width: 100%;
          padding: 1rem;
          border-radius: 9999px;
          background-color: #2d4a14;
          color: white;
          border: none;
          margin-bottom: 1rem;
          font-size: 1rem;
        }
        .input-field::placeholder {
          color: #a0a0a0;
        }
        .input-field:focus {
          outline: 2px solid #e58b02;
        }
      `}</style>
      
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
        {isLoanProcessing ? (
          <div className="flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="text-6xl text-lime-600 icon-bounce mb-4">
              <div style={{animation: 'spin 1s linear infinite', fontSize: '4rem'}}>⟳</div>
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
                  <div style={{fontSize: '5rem', color: 'white'}}>💸</div>
                  <div style={{fontSize: '3rem', color: '#e58b02', marginLeft: '-2rem', marginTop: '2rem'}}>🤝</div>
                </div>
                <h1 className="text-5xl font-extrabold text-white mb-2">{t.welcomeTitle}</h1>
                <p className="text-xl font-semibold text-white mb-8">
                  <span style={{color: '#e58b02'}}>Loans</span> in Minutes, Trust for a Lifetime
                </p>
                <button
                  onClick={() => setCurrentStep('language-select')}
                  className="w-full bg-white text-[#3a5719] font-semibold py-4 px-6 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105"
                  style={{border: 'none', cursor: 'pointer'}}
                >
                  {t.welcomeButton}
                  <span style={{marginLeft: '0.5rem'}}>→</span>
                </button>
                <p className="text-gray-400 text-xs mt-4 break-all">
                  User ID: {userId || 'Authenticating...'}
                </p>
              </div>
            )}

            {currentStep === 'language-select' && (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#3a5719] rounded-3xl min-h-[400px]">
                <h1 className="text-4xl font-extrabold text-white mb-6">{t.welcomeTitle}</h1>
                <p className="text-xl text-gray-200 mb-8">Choose your language</p>
                <div className="flex flex-col space-y-4 w-full max-w-xs">
                  <button
                    onClick={() => { setLanguage('en'); setCurrentStep('start-loan'); }}
                    className="language-button"
                    style={{backgroundColor: '#e58b02'}}
                  >
                    English
                    <span className="text-2xl ml-2">🇮🇳</span>
                  </button>
                  <button
                    onClick={() => { setLanguage('hi'); setCurrentStep('start-loan'); }}
                    className="language-button"
                    style={{backgroundColor: '#4ade80'}}
                  >
                    हिंदी
                    <span className="text-2xl ml-2">🇮🇳</span>
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'start-loan' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble" style={{backgroundColor: '#f3f4f6', borderLeft: '4px solid #3a5719'}}>
                  <div className="flex items-center">
                    <div style={{fontSize: '1.5rem', color: '#3a5719', marginRight: '0.5rem'}}>👨‍💼</div>
                    <p className="text-gray-800">{t.chat1}</p>
                  </div>
                </div>
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={() => setCurrentStep('collect-data')}
                    className="chat-button"
                    style={{backgroundColor: '#e58b02'}}
                  >
                    {t.yes} ✓
                  </button>
                  <button
                    className="chat-button"
                    style={{backgroundColor: '#9ca3af', color: '#1f2937'}}
                  >
                    {t.no} ✗
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'collect-data' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble" style={{backgroundColor: '#f3f4f6', borderLeft: '4px solid #3b82f6'}}>
                  <div className="flex items-center">
                    <div style={{fontSize: '1.5rem', color: '#3b82f6', marginRight: '0.5rem'}}>📄</div>
                    <p className="text-gray-800">{t.chat2}</p>
                  </div>
                </div>
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={processLoan}
                    className="chat-button"
                    style={{backgroundColor: '#e58b02'}}
                  >
                    {t.giveConsent} 🆔
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-4 text-center">
                  {t.consentNote}
                </p>
              </div>
            )}

            {currentStep === 'approved' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble" style={{backgroundColor: '#dcfce7', borderLeft: '4px solid #16a34a'}}>
                  <div className="flex items-center">
                    <div style={{fontSize: '1.5rem', color: '#16a34a', marginRight: '0.5rem'}}>✅</div>
                    <p className="text-gray-800">{t.approvedChat}</p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-green-500 w-full max-w-sm mt-6 text-center">
                  <h3 className="text-2xl font-bold mb-2 text-green-700">{t.approvedTitle}</h3>
                  <p className="text-5xl font-extrabold text-gray-900 mb-2">
                    ₹{loanOffer?.amount?.toLocaleString('en-IN')}
                  </p>
                  <div className="flex items-center justify-center text-gray-600 mb-4 text-lg">
                    <span style={{marginRight: '0.5rem'}}>₹</span>
                    <p className="font-semibold">{t.emi}: ₹{loanOffer?.emi?.toLocaleString('en-IN')}/month</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep('disbursed')}
                    className="w-full chat-button"
                    style={{backgroundColor: '#e58b02'}}
                  >
                    {t.accept}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'rejected' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble" style={{backgroundColor: '#fee2e2', borderLeft: '4px solid #dc2626'}}>
                  <div className="flex items-center">
                    <div style={{fontSize: '1.5rem', color: '#dc2626', marginRight: '0.5rem'}}>❌</div>
                    <p className="text-gray-800">{t.rejectedChat}</p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-red-500 w-full max-w-sm mt-6 text-center">
                  <h3 className="text-2xl font-bold mb-2 text-red-700">{t.rejectedTitle}</h3>
                  <p className="text-gray-600 mb-4 text-lg">Reason: {rejectionReason}</p>
                  <p className="text-sm text-gray-500">
                    {t.rejectedNote}
                  </p>
                </div>
                <button
                  onClick={resetApplication}
                  className="chat-button mt-4"
                  style={{backgroundColor: '#6b7280'}}
                >
                  {t.startOver}
                </button>
              </div>
            )}

            {currentStep === 'disbursed' && (
              <div className="flex flex-col items-center justify-center p-8 bg-[#3a5719] rounded-3xl min-h-[400px]">
                <div className="chat-bubble left-bubble" style={{backgroundColor: '#dcfce7', borderLeft: '4px solid #16a34a'}}>
                  <div className="flex items-center">
                    <div style={{fontSize: '1.5rem', color: '#16a34a', marginRight: '0.5rem'}}>💰</div>
                    <p className="text-gray-800">{t.disbursedChat}</p>
                  </div>
                </div>
                <div className="mt-8 text-center">
                  <button
                    onClick={resetApplication}
                    className="chat-button"
                    style={{backgroundColor: '#e58b02', maxWidth: '12rem'}}
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
