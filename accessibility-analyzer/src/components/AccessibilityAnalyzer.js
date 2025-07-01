//accessibility-analyzer\src\components\AccessibilityAnalyzer.js

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';
import {
  XCircle,
  AlertTriangle,
  Lightbulb,
  Shield,
  Users,
  Award,
  Globe,
  Zap,
  Clock,
  Target,
  TrendingUp,
  BarChart3,
  Star,
  Code,
  RefreshCw,
  Download,
  ExternalLink,
  Filter,
  SortDesc,
  Copy,
  CheckCircle,
  Eye,
  Palette,
  FileText,
  Keyboard,
  Type,
  History, // NEW: For history section icon
  User, LogIn, LogOut, UserPlus // NEW: Auth-related icons
} from 'lucide-react';
 
import { jsPDF } from 'jspdf';       // Import jsPDF
import html2canvas from 'html2canvas'; // Import html2canvas


import { analyzeWebsite as apiAnalyzeWebsite,  getAnalysisHistory as apiGetAnalysisHistory, // **NEW: Import the new history function**
  registerUser, // **NEW: Import auth functions**
  loginUser,
  logoutUser,
  getCurrentUser} from '../services/api';

 
 
const AccessibilityAnalyzer = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [showConfetti, setShowConfetti] = useState(false);
  const [history, setHistory] = useState([]); // **NEW: State for analysis history**
const [isLoadingHistory, setIsLoadingHistory] = useState(false); // **NEW: Loading state for history**

// --- NEW Auth States --- //
const [currentUser, setCurrentUser] = useState(null); // Stores logged-in user info //
const [showAuthModal, setShowAuthModal] = useState(false); // Controls auth modal visibility //
const [authMode, setAuthMode] = useState('login'); // 'login' or 'register' //
const [authUsername, setAuthUsername] = useState(''); // Auth form username //
const [authPassword, setAuthPassword] = useState(''); // Auth form password //
const [authError, setAuthError] = useState(''); // Auth error message //
// --- END Auth States ---

// Generate categories from violations
  const generateCategoriesFromViolations = (violations) => {
    const categories = {
      colorContrast: { score: 0, issues: 0, status: 'success', description: 'Color and contrast accessibility' },
      images: { score: 0, issues: 0, status: 'success', description: 'Image accessibility and alt text' },
      forms: { score: 0, issues: 0, status: 'success', description: 'Form labels and accessibility' },
      navigation: { score: 0, issues: 0, status: 'success', description: 'Navigation and keyboard access' },
      structure: { score: 0, issues: 0, status: 'success', description: 'Page structure and headings' }
    };

    violations?.forEach(violation => {
      if (violation.id.includes('color') || violation.id.includes('contrast')) {
        categories.colorContrast.issues++;
      } else if (violation.id.includes('image') || violation.id.includes('alt')) {
        categories.images.issues++;
      } else if (violation.id.includes('form') || violation.id.includes('label')) {
        categories.forms.issues++;
      } else if (violation.id.includes('nav') || violation.id.includes('keyboard')) {
        categories.navigation.issues++;
      } else {
        categories.structure.issues++;
      }
    });

    Object.keys(categories).forEach(key => {
      const category = categories[key];
      category.score = Math.max(0, 100 - (category.issues * 20));
      category.status = category.score >= 90 ? 'success' : 
                       category.score >= 70 ? 'warning' : 'error';
    });

    return categories;
  };

  // Generate fixed code examples
  const generateFixedCode = (violation) => {
    const fixes = {
      'color-contrast': (html) => html.replace('text-gray-400 bg-gray-300', 'text-gray-800 bg-white'),
      'image-alt': (html) => html.replace('<img src=', '<img alt="Descriptive text" src='),
      'label': (html) => html.replace('<input', '<input aria-label="Input description"'),
      'heading-order': (html) => html.replace('<h3>', '<h2>'),
      default: (html) => html + ' <!-- Add appropriate accessibility attributes -->'
    };

    const originalHtml = violation.nodes?.[0]?.html || '';
    const fixFunction = fixes[violation.id] || fixes.default;
    return fixFunction(originalHtml);
  };

  // Get score-based styling
  const getScoreBackground = (score) => {
    if (score >= 90) return 'bg-emerald-50 border-emerald-200';
    if (score >= 75) return 'bg-yellow-50 border-yellow-200';
    if (score >= 60) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradientByScore = (score) => {
    if (score >= 90) return 'from-emerald-500 to-green-600';
    if (score >= 75) return 'from-yellow-500 to-orange-500';
    if (score >= 60) return 'from-orange-500 to-red-500';
    return 'from-red-500 to-pink-600';
  };

  // Get issue icons
  const getIssueIcon = (type) => {
    const iconProps = "w-6 h-6";
    if (type === 'critical') return <XCircle className={`${iconProps} text-red-500`} />;
    if (type === 'warning') return <AlertTriangle className={`${iconProps} text-yellow-500`} />;
    return <Lightbulb className={`${iconProps} text-blue-500`} />;
  };

  // Get category icons
  const getCategoryIcon = (category) => {
    const iconProps = "w-6 h-6 text-white";
    switch (category) {
      case 'colorContrast': return <Palette className={iconProps} />;
      case 'images': return <Eye className={iconProps} />;
      case 'forms': return <FileText className={iconProps} />;
      case 'navigation': return <Keyboard className={iconProps} />;
      case 'structure': return <Type className={iconProps} />;
      default: return <Shield className={iconProps} />;
    }
  };

  // Copy to clipboard function
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Estimate affected users
  const estimateAffectedUsers = (impact) => {
    const percentages = {
      critical: '15% of users with disabilities',
      serious: '10% of users with disabilities', 
      moderate: '5% of users',
      minor: '2% of users'
    };
    return percentages[impact] || 'Some users';
  };

  // ========== HELPER FUNCTIONS END ==========


// NEW: Function to check current user on load //
const checkUser = useCallback(async () => { //
  const user = await getCurrentUser(); //
  setCurrentUser(user); //
  if (user) { // If user is logged in, fetch history //
    fetchHistory(); //
  } else { // If not logged in, clear history //
    setHistory([]); //
  }
}, []); // Removed fetchHistory from dependencies here, as it's defined below but depends on currentUser //

// NEW: useEffect to check user on component mount //
useEffect(() => { //
  checkUser(); //
}, [checkUser]); // Dependency array includes checkUser so it runs on initial mount //


// NEW: Function to fetch history from the backend //
const fetchHistory = useCallback(async () => { //
  if (!currentUser) { // Only fetch if user is logged in //
    setHistory([]); // Ensure history is empty if no user //
    return; //
  }
  setIsLoadingHistory(true); //
  try { //
    const fetchedHistory = await apiGetAnalysisHistory(); //
    setHistory(fetchedHistory); //
  } catch (error) { //
    console.error('Error fetching history:', error); //
    // If 401 (Unauthorized), user might be logged out/token expired //
    if (error.message.includes('401')) { //
      setCurrentUser(null); // Clear user state //
      logoutUser(); // Clear token locally //
      setAuthError('Your session expired. Please log in again.'); //
    }
  } finally { //
    setIsLoadingHistory(false); //
  }
}, [currentUser]);




  // Computed value for filtered issues
  const filteredIssues = useMemo(() => {
    if (!results?.issues) return [];
    
    let filtered = results.issues;

    // Apply filter
    if (filterType !== 'all') {
      filtered = filtered.filter(issue => issue.type === filterType);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return a.priority - b.priority;
        case 'category':
          return a.category.localeCompare(b.category);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return filtered;
  }, [results?.issues, filterType, sortBy]);

  // Enhanced analysis with progress simulation
 const analyzeWebsite = useCallback(async (websiteUrl) => {
   if (!currentUser) { // Prevent analysis if not logged in //
    setAuthError('Please log in or register to analyze websites.'); //
    setShowAuthModal(true); // Show auth modal //
    return; //
  }
  setIsAnalyzing(true);
  setAnalysisProgress(0);
  
  // Progress simulation
  const progressInterval = setInterval(() => {
    setAnalysisProgress(prev => (prev < 80 ? prev + 10 : prev));
  }, 500);

  try {
    const analysisResults = await apiAnalyzeWebsite(websiteUrl);
    
    clearInterval(progressInterval);
    setAnalysisProgress(100);
    
    const formattedResults = {
      url: websiteUrl,
      score: Math.round(analysisResults.score * 100),
      previousScore: null, // You might want to implement this
      totalIssues: analysisResults.violations?.length || 0,
      criticalIssues: analysisResults.violations?.filter(v => v.impact === 'critical').length || 0,
      warningIssues: analysisResults.violations?.filter(v => v.impact === 'serious').length || 0,
      infoIssues: analysisResults.violations?.filter(v => ['moderate', 'minor'].includes(v.impact)).length || 0,
      scanTime: `${(Math.random() * 2 + 2).toFixed(1)}s`,
      pageElements: analysisResults.passes?.length + analysisResults.violations?.length || 0,
      // Generate categories from violations
      categories: generateCategoriesFromViolations(analysisResults.violations),
      issues: analysisResults.violations?.map(v => ({
        id: v.id,
        type: v.impact === 'critical' ? 'critical' : 'warning',
        category: v.tags.find(t => t.startsWith('wcag')) || 'General',
        element: v.nodes[0]?.html || '',
        issue: v.description,
        wcagLevel: v.tags.find(t => t.match(/wcag\d{3}/i)) || '',
        impact: v.impact,
        suggestion: v.help,
        priority: v.impact === 'critical' ? 1 : 2,
        affectedUsers: estimateAffectedUsers(v.impact),
        codeExample: {
          before: v.nodes[0]?.html || '',
          after: generateFixedCode(v)
        }
      })) || []
    };

    setResults(formattedResults);
    fetchHistory();

    if (formattedResults.score >= 85) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    setResults({
      error: true,
      message: error.message,
      score: 0,
      issues: []
    });
  } finally {
    clearInterval(progressInterval);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
  }
},[currentUser, fetchHistory]);

  const handleAnalyze = async (e) => {
  e.preventDefault();
  
  if (!url.trim()) {
    alert('Please enter a URL');
    return;
  }


  
  // Ensure URL has http/https
  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    new URL(targetUrl); // Validate URL format
    await analyzeWebsite(targetUrl);
  } catch (error) {
    setResults({
      error: true,
      message: 'Please enter a valid URL (e.g., https://example.com)',
      score: 0,
      issues: []
    });
  }
}; 

// NEW: Auth handlers //
const handleAuthSubmit = async (e) => { //
  e.preventDefault(); //
  setAuthError(''); // Clear previous errors //
  try { //
    if (authMode === 'register') { //
      await registerUser(authUsername, authPassword); //
      setCurrentUser({ username: authUsername }); // Set current user on successful register //
      fetchHistory(); // Fetch history for new user //
      setShowAuthModal(false); // Close modal //
    } else { // login //
      await loginUser(authUsername, authPassword); //
      setCurrentUser({ username: authUsername }); // Set current user on successful login //
      fetchHistory(); // Fetch history for logged in user //
      setShowAuthModal(false); // Close modal //
    }
  } catch (error) { //
    console.error('Auth error:', error); //
    setAuthError(error.message || 'Authentication failed'); // Display error //
  }
};

const handleLogout = () => { //
  logoutUser(); // Clear token in api service //
  setCurrentUser(null); // Clear user state //
  setHistory([]); // Clear history on logout //
  setResults(null); // Clear current analysis results //
};









// NEW: Function to handle PDF Download
  const handleDownloadPdf = async () => {
    if (!results) {
      alert('No analysis results to download.');
      return;
    }

    // Target the main results container by its ID
    const input = document.getElementById('report-content');

    if (!input) {
      alert('Could not find report content to generate PDF.');
      console.error("Element with ID 'report-content' not found.");
      return;
    }

    try {
      // Temporarily hide elements that shouldn't be in the PDF (e.g., re-analyze button, view site button if desired)
      // This part is optional but useful for cleaner PDFs
      // const buttonsToHide = document.querySelectorAll('.hide-for-pdf');
      // buttonsToHide.forEach(btn => btn.style.display = 'none');


      const canvas = await html2canvas(input, {
        scale: 2, // Increase scale for better resolution in PDF
        useCORS: true, // Important if your images/fonts are from different origins
        logging: true, // Enable logging for html2canvas to debug any issues
        allowTaint: true, // Allow images/canvas to be "tainted" if CORS issues occur (less secure, but can help)
        // Adjust windowWidth/Height if your content overflows horizontally/vertically without scrolling
        // windowWidth: input.scrollWidth,
        // windowHeight: input.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' size
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width; // Calculate height to maintain aspect ratio
      let heightLeft = imgHeight;
      let position = 0; // Start at the top of the page

      // Add image to PDF, handling multiple pages if content is long
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight; // Calculate position for the next page
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Sanitize URL for filename
      const filename = `accessibility_report_${results.url.replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.pdf`;
      pdf.save(filename);
      console.log('PDF generated successfully!');

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      // Re-show any hidden buttons (if you implemented that step)
      // buttonsToHide.forEach(btn => btn.style.display = '');
    }
  };


return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 blur-3xl animate-pulse"></div>
        <div className="absolute delay-1000 rounded-full -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-400/20 to-blue-600/20 blur-3xl animate-pulse"></div>
      </div>

      {/* Confetti effect for high scores */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded bg-gradient-to-r from-yellow-400 to-pink-500 animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }}
            ></div>
          ))}
        </div>
      )}

      {/* Enhanced Header */}
      <div className="relative border-b shadow-lg bg-white/80 backdrop-blur-xl border-white/20">
        <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="p-3 shadow-lg bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                
                <div className="absolute w-4 h-4 bg-green-500 rounded-full -top-1 -right-1 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text">
                  AccessibilityAI Pro
                </h1>
                <p className="font-medium text-gray-600">Advanced WCAG compliance analysis with AI-powered insights</p>
              </div>
            </div>
            
            <div className="items-center hidden space-x-6 md:flex">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span></span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Award className="w-4 h-4" />
                <span> </span>
              </div>

              {/* Auth/User Info */}
              <div className="flex items-center space-x-4"> {/* **NEW Auth Section** */}
                {currentUser ? ( // If logged in //
                  <>
                    <span className="flex items-center gap-2 text-gray-700">
                      <User className="w-5 h-5" />
                      Hello, {currentUser.username}!
                    </span>
                    <button
                      onClick={handleLogout} // Call logout function //
                      className="flex items-center gap-2 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </>
                ) : ( // If not logged in //
                  <button
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true); setAuthError(''); }} // Show login modal //
                    className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <LogIn className="w-4 h-4" /> Login / Register
                  </button>
                )}  
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Enhanced URL Input Section */}
        <div className="p-8 mb-8 border shadow-2xl bg-white/90 backdrop-blur-xl rounded-3xl border-white/20">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Analyze Website Accessibility</h2>
            <p className="text-gray-600">Get comprehensive WCAG compliance analysis with actionable code suggestions</p>
          </div>
          
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="relative">
              <Globe className="absolute w-5 h-5 text-gray-400 transform -translate-y-1/2 left-4 top-1/2" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter website URL (e.g., https://example.com)"
                className="w-full py-4 pl-12 pr-4 text-lg transition-all duration-200 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 bg-white/70 backdrop-blur-sm"
                disabled={isAnalyzing}
              />
            </div>
            
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="submit"
                disabled={isAnalyzing || !url.trim()}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-2xl hover:from-blue-700 hover:to-purple-800 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Analyze Now
                  </>
                )}
              </button>
              
              {!isAnalyzing && (
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>~3 seconds</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Target className="w-4 h-4" />
                    <span>200+ checks</span>
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="mt-6">
              <div className="flex justify-between mb-2 text-sm text-gray-600">
                <span>Analyzing accessibility...</span>
                <span>{analysisProgress}%</span>
              </div>
              <div className="w-full h-2 overflow-hidden bg-gray-200 rounded-full">
                <div
                  className="h-2 transition-all duration-300 ease-out rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
                  style={{ width: `${analysisProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Results Section */}
        {results && (
        <div id="report-content" className="space-y-8"> {/* Add this ID */}
           
            {/* Score Overview Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className={`relative p-6 rounded-3xl border-2 ${getScoreBackground(results.score)} overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 -mt-16 -mr-16 rounded-full bg-gradient-to-br from-white/10 to-transparent"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-gray-600 uppercase">Overall Score</p>
                      <div className="flex items-baseline space-x-2">
                        <p className={`text-4xl font-bold ${getScoreColor(results.score)}`}>{results.score}%</p>
                        {results.previousScore && (
                          <div className="flex items-center text-sm">
                            {results.score > results.previousScore ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                            )}
                            <span className={results.score > results.previousScore ? 'text-green-600' : 'text-red-600'}>
                              {Math.abs(results.score - results.previousScore)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${getGradientByScore(results.score)}`}>
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  {results.score >= 90 && (
                    <div className="flex items-center space-x-1 text-emerald-600">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">Excellent!</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="relative p-6 overflow-hidden border-2 border-red-200 rounded-3xl bg-red-50">
                <div className="absolute top-0 right-0 w-32 h-32 -mt-16 -mr-16 rounded-full bg-gradient-to-br from-red-100/50 to-transparent"></div>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-gray-600 uppercase">Critical Issues</p>
                      <p className="text-4xl font-bold text-red-600">{results.criticalIssues}</p>
                      <p className="mt-1 text-xs text-red-500">Requires immediate attention</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-red-600">
                      <XCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="relative p-6 overflow-hidden border-2 border-yellow-200 rounded-3xl bg-yellow-50">
                <div className="absolute top-0 right-0 w-32 h-32 -mt-16 -mr-16 rounded-full bg-gradient-to-br from-yellow-100/50 to-transparent"></div>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-gray-600 uppercase">Warnings</p>
                      <p className="text-4xl font-bold text-yellow-600">{results.warningIssues}</p>
                      <p className="mt-1 text-xs text-yellow-600">Should be addressed</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="relative p-6 overflow-hidden border-2 border-blue-200 rounded-3xl bg-blue-50">
                <div className="absolute top-0 right-0 w-32 h-32 -mt-16 -mr-16 rounded-full bg-gradient-to-br from-blue-100/50 to-transparent"></div>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-gray-600 uppercase">Improvements</p>
                      <p className="text-4xl font-bold text-blue-600">{results.infoIssues}</p>
                      <p className="mt-1 text-xs text-blue-600">Enhancement opportunities</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600">
                      <Lightbulb className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis History Section (only show if logged in) */}
    {currentUser && ( // **NEW: Only show history if a user is logged in** //
      <div className="relative px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="p-8 mb-8 border shadow-2xl bg-white/90 backdrop-blur-xl rounded-3xl border-white/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <History className="w-6 h-6 text-blue-600" />
              Analysis History
            </h2>
            {isLoadingHistory && ( //
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-4 h-4 border-2 border-blue-400 rounded-full border-t-transparent animate-spin"></div>
                Loading history...
              </div>
            )}
          </div>

          {!isLoadingHistory && history.length === 0 && ( //
            <p className="py-4 text-center text-gray-600">No analysis history found. Start by analyzing a website!</p> //
          )}

          {!isLoadingHistory && history.length > 0 && ( //
            <div className="overflow-x-auto"> //
              <table className="min-w-full divide-y divide-gray-200"> //
                <thead className="bg-gray-50"> //
                  <tr> //
                    <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"> //
                      URL //
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"> //
                      Score //
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"> //
                      Total Issues //
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"> //
                      Analyzed At //
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase"> //
                      Actions //
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200"> //
                  {history.map((entry) => ( //
                    <tr key={entry._id}> {/* MongoDB uses _id for unique ID */} //
                      <td className="px-6 py-4 whitespace-nowrap"> //
                        <div className="text-sm text-blue-600 cursor-pointer hover:underline" //
                             onClick={() => setUrl(entry.url)}> {/* Set URL for re-analysis */} //
                          {entry.url.length > 50 ? `${entry.url.substring(0, 50)}...` : entry.url} //
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"> //
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getScoreColor(entry.score * 100).replace('text-', 'bg-')} bg-opacity-20 ${getScoreColor(entry.score * 100)}`}> //
                          {Math.round(entry.score * 100)}% //
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap"> //
                        {entry.summary.totalIssues} //
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap"> //
                        {new Date(entry.timestamp).toLocaleString()} //
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap"> //
                        <button //
                          onClick={() => { //
                            setUrl(entry.url); //
                            analyzeWebsite(entry.url); //
                            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for analysis //
                          }}
                          className="mr-2 text-indigo-600 hover:text-indigo-900" //
                        >
                          Re-analyze //
                        </button>
                        {/* Optionally add a 'View Full Report' button if you can load old results into current view */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}
// ...

            {/* Enhanced Tab Navigation */}
            <div className="overflow-hidden border shadow-2xl bg-white/90 backdrop-blur-xl rounded-3xl border-white/20">
              <div className="border-b border-gray-200/50">
                <nav className="flex overflow-x-auto">
            {[
            { id: 'overview', label: 'Overview', icon: BarChart3, count: null },
            { id: 'issues', label: 'Issues & Fixes', icon: Code, count: results?.totalIssues || 0 },
            {
                id: 'categories',
                label: 'Categories',
                icon: Shield,
                count: results?.categories ? Object.keys(results.categories).length : 0
            }
            ].map((tab) => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 flex items-center gap-2 rounded-md transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
            >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                <span className="bg-white text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {tab.count}
                </span>
                )}
            </button>
            ))}
                
                </nav>
              </div>

              <div className="p-8">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">Analysis Summary</h3>
                        <p className="mt-1 text-gray-600">Comprehensive accessibility evaluation results</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => analyzeWebsite(results.url)}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 transition-colors bg-gray-100 rounded-xl hover:bg-gray-200"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Re-analyze
                        </button>
                        <button
                          onClick={handleDownloadPdf} // Connect the function here
                          className="flex items-center gap-2 px-4 py-2 text-white transition-all shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl hover:from-green-600 hover:to-emerald-700"
                        >                          
                        <Download className="w-4 h-4" />
                          Export Report
                        </button>
                        <a
                          href={results.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 text-blue-700 transition-colors bg-blue-100 rounded-xl hover:bg-blue-200"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Site
                        </a>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                      {/* Site Info */}
                      <div className="space-y-6 lg:col-span-2">
                        <div className="p-6 border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
                          <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900">
                            <Globe className="w-5 h-5" />
                            Analyzed Website
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <p className="mb-1 text-sm text-gray-600">URL</p>
                              <p className="p-3 font-mono text-sm break-all bg-white border rounded-lg">{results.url}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Scan Time</p>
                                <p className="font-semibold text-gray-900">{results.scanTime}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Elements Scanned</p>
                                <p className="font-semibold text-gray-900">{results.pageElements}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* WCAG Compliance Levels */}
                        <div className="p-6 border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl">
                          <h4 className="flex items-center gap-2 mb-6 font-semibold text-gray-900">
                            <Award className="w-5 h-5" />
                            WCAG Compliance Levels
                          </h4>
                          <div className="space-y-4">
                            {[
                              { level: 'Level A', score: 85, color: 'emerald', description: 'Basic accessibility' },
                              { level: 'Level AA', score: 72, color: 'yellow', description: 'Standard compliance' },
                              { level: 'Level AAA', score: 45, color: 'red', description: 'Enhanced accessibility' }
                            ].map((item) => (
                              <div key={item.level} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                                <div>
                                  <span className="font-medium text-gray-900">{item.level}</span>
                                  <p className="text-sm text-gray-600">{item.description}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full">
                                    <div
                                      className={`h-2 rounded-full bg-${item.color}-500`}
                                      style={{ width: `${item.score}%` }}
                                    ></div>
                                  </div>
                                  <span className={`font-bold text-${item.color}-600 min-w-[3rem] text-right`}>
                                    {item.score}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Priority Actions Sidebar */}
                      <div className="space-y-6">
                        <div className="p-6 border border-red-200 bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl">
                          <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900">
                            <Target className="w-5 h-5" />
                            Priority Actions
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-white border border-red-100 rounded-lg">
                              <XCircle className="flex-shrink-0 w-5 h-5 text-red-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">Fix {results.criticalIssues} critical issues</p>
                                <p className="text-xs text-gray-600">Immediate attention required</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white border border-yellow-100 rounded-lg">
                              <AlertTriangle className="flex-shrink-0 w-5 h-5 text-yellow-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">Address {results.warningIssues} warnings</p>
                                <p className="text-xs text-gray-600">Important improvements</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white border border-blue-100 rounded-lg">
                              <Lightbulb className="flex-shrink-0 w-5 h-5 text-blue-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">Consider {results.infoIssues} enhancements</p>
                                <p className="text-xs text-gray-600">Optional optimizations</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Impact Estimate */}
                        <div className="p-6 border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
                          <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900">
                            <Users className="w-5 h-5" />
                            Impact Estimate
                          </h4>
                          <div className="space-y-4">
                            <div className="text-center">
                              <div className="mb-1 text-3xl font-bold text-blue-600">~25%</div>
                              <p className="text-sm text-gray-600">of users affected by current issues</p>
                            </div>
                            <div className="p-4 bg-white border border-blue-100 rounded-lg">
                              <p className="text-sm text-gray-700">
                                Fixing critical issues could improve accessibility for approximately 
                                <span className="font-semibold text-blue-600"> 1 in 4 users</span> with disabilities.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Issues & Fixes Tab */}
                {activeTab === 'issues' && (
                  <div className="space-y-6">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">Issues & Code Suggestions</h3>
                        <p className="mt-1 text-gray-600">Detailed analysis with actionable fixes</p>
                      </div>
                      
                      {/* Filters and Sort */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-gray-500" />
                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="all">All Issues</option>
                            <option value="critical">Critical Only</option>
                            <option value="warning">Warnings Only</option>
                            <option value="info">Info Only</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <SortDesc className="w-4 h-4 text-gray-500" />
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="priority">Priority</option>
                            <option value="category">Category</option>
                            <option value="type">Severity</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      {filteredIssues.map((issue) => (
                        <div key={issue.id} className="overflow-hidden transition-all duration-200 bg-white border border-gray-200 shadow-sm rounded-2xl hover:shadow-md">
                          <div className="p-6">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                {getIssueIcon(issue.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                  <h4 className="text-lg font-semibold text-gray-900">{issue.category}</h4>
                                  <span className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                                    WCAG {issue.wcagLevel}
                                  </span>
                                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                    issue.impact === 'High' ? 'bg-red-100 text-red-700' :
                                    issue.impact === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {issue.impact} Impact
                                  </span>
                                </div>
                                
                                <p className="mb-2 font-medium text-gray-700">{issue.issue}</p>
                                <p className="mb-3 text-gray-600">{issue.suggestion}</p>
                                
                                <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                                  <Users className="w-4 h-4" />
                                  <span>{issue.affectedUsers}</span>
                                </div>
                                
                                <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <Code className="w-4 h-4 text-gray-600" />
                                      <span className="font-medium text-gray-700">Code Example</span>
                                    </div>
                                    <button
                                      onClick={() => copyToClipboard(issue.codeExample.after)}
                                      className="flex items-center gap-1 px-3 py-1 text-xs text-blue-600 transition-colors rounded-lg hover:text-blue-800 bg-blue-50 hover:bg-blue-100"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copy Fix
                                    </button>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span className="text-xs font-medium text-red-700">Before (Issue)</span>
                                      </div>
                                      <pre className="p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap border border-red-200 rounded-lg bg-red-50">
                                        {issue.codeExample.before}
                                      </pre>
                                    </div>
                                    
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span className="text-xs font-medium text-green-700">After (Fixed)</span>
                                      </div>
                                      <pre className="p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap border border-green-200 rounded-lg bg-green-50">
                                        {issue.codeExample.after}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredIssues.length === 0 && (
                      <div className="py-12 text-center">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                        <h4 className="mb-2 text-xl font-semibold text-gray-900">No Issues Found</h4>
                        <p className="text-gray-600">Great job! No issues match your current filter criteria.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Categories Tab */}
                {activeTab === 'categories' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Category Breakdown</h3>
                      <p className="mt-1 text-gray-600">Detailed analysis by accessibility category</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(results.categories).map(([key, category]) => (
                        <div key={key} className="overflow-hidden transition-all duration-200 bg-white border border-gray-200 shadow-sm rounded-2xl hover:shadow-lg">
                          <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`p-3 rounded-xl bg-gradient-to-br ${getGradientByScore(category.score)}`}>
                                {getCategoryIcon(key)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </h4>
                                <p className="text-sm text-gray-600">{category.description}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Score</span>
                                <span className={`font-bold text-xl ${getScoreColor(category.score)}`}>
                                  {category.score}%
                                </span>
                              </div>
                              
                              <div className="w-full h-3 overflow-hidden bg-gray-200 rounded-full">
                                <div
                                  className={`h-3 rounded-full transition-all duration-500 ${
                                    category.score >= 90 ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                                    category.score >= 75 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                    category.score >= 60 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                    'bg-gradient-to-r from-red-500 to-pink-600'
                                  }`}
                                  style={{ width: `${category.score}%` }}
                                ></div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Issues Found</span>
                                <span className="font-semibold text-gray-900">{category.issues}</span>
                              </div>
                              
                              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium w-full justify-center ${
                                category.status === 'success' ? 'bg-green-100 text-green-800' :
                                category.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {category.status === 'success' ? 'Good' :
                                 category.status === 'warning' ? 'Needs Attention' : 'Critical'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      

      {/* accessibility-analyzer\src\components\AccessibilityAnalyzer.js */}

{/* ... (after the outermost div closing tag that wraps all content, but before the final return closing brace) ... */}

      {/* NEW: Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="p-8 bg-white rounded-lg shadow-xl w-96">
            <h2 className="mb-4 text-2xl font-bold text-center">
              {authMode === 'login' ? 'Login' : 'Register'}
            </h2>
            {authError && <p className="mb-4 text-center text-red-500">{authError}</p>}{/* Display auth errors */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
            <div className="mt-4 text-center">
              {authMode === 'login' ? (
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => { setAuthMode('register'); setAuthError(''); }} // Switch to register
                    className="text-blue-600 hover:underline"
                  >
                    Register
                  </button>
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(''); }} // Switch to login
                    className="text-blue-600 hover:underline"
                  >
                    Login
                  </button>
                </p>
              )}
              <button // Close button
                onClick={() => setShowAuthModal(false)}
                className="mt-2 text-sm text-gray-500 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
{/* ... */}


    </div>
  
  );
};

export default AccessibilityAnalyzer;