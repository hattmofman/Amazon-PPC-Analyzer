import React, { useState, useMemo, useEffect } from 'react';
import { Upload, TrendingUp, TrendingDown, DollarSign, Target, MousePointer, AlertTriangle, CheckCircle, XCircle, Filter, Search, Download, ChevronDown, ChevronRight, ArrowUpDown, Settings, Loader2, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

function App({ session, supabase }) {
  // Page navigation states
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'auth', 'account', 'analysis'
  
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(!!session);
  const [showLogin, setShowLogin] = useState(true);
  const [email, setEmail] = useState(session?.user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState(session?.user || null);

  // Saved analyses
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [analysisName, setAnalysisName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingFileName, setPendingFileName] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);

  // Load user data when authenticated
  useEffect(() => {
    if (session) {
      setIsAuthenticated(true);
      setUser(session.user);
      setEmail(session.user.email);
      loadSavedAnalyses();
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setSavedAnalyses([]);
    }
  }, [session]);

  // Instruction page states
  const [showInstructions, setShowInstructions] = useState(false);
  const [uploadAnalysisName, setUploadAnalysisName] = useState('');
  
  // Processing states
  const [processingSteps, setProcessingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMatchType, setFilterMatchType] = useState('all');
  const [minClicks, setMinClicks] = useState(0);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedKeywords, setExpandedKeywords] = useState(new Set());
  const [targetAcos, setTargetAcos] = useState(20);
  const [showSettings, setShowSettings] = useState(false);
  
  // Sorting states
  const [campaignSort, setCampaignSort] = useState({ column: 'spend', direction: 'desc' });
  const [keywordSort, setKeywordSort] = useState({ column: 'spend', direction: 'desc' });
  const [wastedSort, setWastedSort] = useState({ column: 'spend', direction: 'desc' });
  const [matchTypeSort, setMatchTypeSort] = useState({ column: 'spend', direction: 'desc' });
  const [inefficientSort, setInefficientSort] = useState({ column: 'spend', direction: 'desc' });

  // Pagination states
  const [matchTypeRowsPerPage, setMatchTypeRowsPerPage] = useState(10);
  const [matchTypeCurrentPage, setMatchTypeCurrentPage] = useState(1);
  const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(20);
  const [campaignCurrentPage, setCampaignCurrentPage] = useState(1);
  const [keywordRowsPerPage, setKeywordRowsPerPage] = useState(100);
  const [keywordCurrentPage, setKeywordCurrentPage] = useState(1);
  const [wastedRowsPerPage, setWastedRowsPerPage] = useState(50);
  const [wastedCurrentPage, setWastedCurrentPage] = useState(1);
  const [inefficientRowsPerPage, setInefficientRowsPerPage] = useState(50);
  const [inefficientCurrentPage, setInefficientCurrentPage] = useState(1);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!email || !password) {
      setAuthError('Please enter both email and password');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      setIsAuthenticated(true);
      setUser(data.user);
      setCurrentPage('account');
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!email || !password || !confirmPassword) {
      setAuthError('Please fill in all fields');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    if (!marketingConsent) {
      setAuthError('You must agree to receive updates to create an account');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            marketing_consent: marketingConsent
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        setIsAuthenticated(true);
        setUser(data.user);
        setCurrentPage('account');
        setAuthError('');
      } else {
        setAuthError('Please check your email to confirm your account');
      }
    } catch (error) {
      setAuthError(error.message || 'Signup failed');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      setCurrentPage('landing');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setData(null);
      setAnalysis(null);
      setCurrentAnalysisId(null);
      setSavedAnalyses([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const saveAnalysis = async (analysisName) => {
    if (!analysis || !user) return;

    try {
      const newAnalysis = {
        user_id: user.id,
        analysis_id: Date.now().toString(),
        name: analysisName,
        date: new Date().toISOString(),
        data: data,
        analysis: analysis,
        target_acos: targetAcos
      };

      const { error } = await supabase
        .from('saved_analyses')
        .insert([newAnalysis]);

      if (error) throw error;

      // Reload analyses
      await loadSavedAnalyses();
      
      setShowNameModal(false);
      setAnalysisName('');
      
      return newAnalysis.analysis_id;
    } catch (error) {
      console.error('Error saving analysis:', error);
      alert('Failed to save analysis: ' + error.message);
    }
  };

  const loadSavedAnalyses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setSavedAnalyses(data || []);
    } catch (error) {
      console.error('Error loading analyses:', error);
    }
  };

  const confirmAnalysisName = () => {
    if (!analysisName.trim()) {
      alert('Please enter a name for this analysis');
      return;
    }
    saveAnalysis(analysisName.trim());
    setShowNameModal(false);
  };

  const cancelAnalysisName = () => {
    setShowNameModal(false);
    // Still save with default name
    if (pendingFileName) {
      saveAnalysis(pendingFileName);
    }
  };

  const loadAnalysis = (analysisData) => {
    // Handle both old format (passing ID) and new format (passing object)
    let analysis;
    if (typeof analysisData === 'string') {
      // Old format - find by ID
      analysis = savedAnalyses.find(a => a.analysis_id === analysisData || a.id === analysisData);
    } else {
      // New format - direct object
      analysis = analysisData;
    }
    
    if (analysis) {
      setData(analysis.data);
      setAnalysis(analysis.analysis);
      setTargetAcos(analysis.target_acos || analysis.targetAcos || 20);
      setCurrentAnalysisId(analysis.id || analysis.analysis_id);
      setCurrentPage('analysis');
    }
  };

  const deleteAnalysis = async (analysisId) => {
    if (!window.confirm('Are you sure you want to delete this analysis?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_analyses')
        .delete()
        .eq('id', analysisId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadSavedAnalyses();
      
      if (currentAnalysisId === analysisId) {
        setData(null);
        setAnalysis(null);
        setCurrentAnalysisId(null);
        setCurrentPage('account');
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Failed to delete analysis: ' + error.message);
    }
  };

  const startNewAnalysis = () => {
    setUploadAnalysisName('');
    setShowInstructions(true);
  };

  const handleInstructionFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!uploadAnalysisName.trim()) {
      alert('Please enter a name for this analysis');
      return;
    }

    setShowInstructions(false);
    await processFileWithProgress(file, uploadAnalysisName.trim());
  };

  const processFileWithProgress = async (file, name) => {
    setError(null); // Clear any previous errors
    setLoading(true);
    setIsProcessing(true);
    
    const steps = [
      'Reading Excel file...',
      'Parsing data structure...',
      'Identifying campaigns...',
      'Analyzing performance metrics...',
      'Calculating ROAS & ACOS...',
      'Detecting wasted spend...',
      'Generating recommendations...',
      'Finalizing analysis...'
    ];
    
    setProcessingSteps(steps);
    setCurrentStep(0);

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          await delay(300);
          setCurrentStep(1);
          
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('The file appears to be empty or corrupted.');
          }
          
          await delay(300);
          setCurrentStep(2);
          
          let jsonData = [];
          let sheetFound = false;
          
          // Priority order: look for campaign/keyword sheets first
          const preferredSheetPatterns = [
            /sponsored.*products.*campaigns/i,
            /sponsored.*products/i,
            /campaigns/i,
            /search.*terms/i,
            /keywords/i,
            /targeting/i
          ];
          
          // Skip these sheets
          const skipSheetPatterns = [
            /portfolio/i,
            /summary/i,
            /overview/i
          ];
          
          // First try to find a preferred sheet
          for (let pattern of preferredSheetPatterns) {
            for (let sheetName of workbook.SheetNames) {
              if (pattern.test(sheetName)) {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                if (sheetData && sheetData.length > 0) {
                  jsonData = sheetData;
                  sheetFound = true;
                  console.log(`✓ Found ${sheetData.length} rows in preferred sheet: ${sheetName}`);
                  break;
                }
              }
            }
            if (sheetFound) break;
          }
          
          // If no preferred sheet found, take any sheet that's not in skip list
          if (!sheetFound) {
            for (let sheetName of workbook.SheetNames) {
              // Skip unwanted sheets
              if (skipSheetPatterns.some(pattern => pattern.test(sheetName))) {
                console.log(`✗ Skipping sheet: ${sheetName}`);
                continue;
              }
              
              const worksheet = workbook.Sheets[sheetName];
              const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
              if (sheetData && sheetData.length > 0) {
                jsonData = sheetData;
                sheetFound = true;
                console.log(`✓ Found ${sheetData.length} rows in sheet: ${sheetName}`);
                break;
              }
            }
          }
          
          if (!sheetFound || jsonData.length === 0) {
            throw new Error('No data found in the uploaded file. Please make sure your Excel file contains data and try again.');
          }

          await delay(400);
          setCurrentStep(3);
          
          setData(jsonData);

          await delay(500);
          setCurrentStep(4);
          await delay(300);
          setCurrentStep(5);
          await delay(400);
          setCurrentStep(6);
          
          // Call analyzeData - it sets state AND returns the analysis object
          const analysisResult = analyzeData(jsonData);
          
          if (!analysisResult) {
            throw new Error('Could not analyze the data. Please make sure your file has the correct column names.');
          }
          
          await delay(400);
          setCurrentStep(7);
          await delay(300);
          setCurrentStep(8);
          
          // Auto-save with provided name using Supabase
          if (user) {
            try {
              const newAnalysis = {
                user_id: user.id,
                analysis_id: Date.now().toString(),
                name: name,
                date: new Date().toISOString(),
                data: jsonData,
                analysis: analysisResult,
                target_acos: targetAcos
              };

              const { error } = await supabase
                .from('saved_analyses')
                .insert([newAnalysis]);

              if (!error) {
                await loadSavedAnalyses();
                setCurrentAnalysisId(newAnalysis.analysis_id);
              }
            } catch (error) {
              console.error('Error auto-saving analysis:', error);
            }
          }
          
          setCurrentPage('analysis');
          setActiveTab('overview');
          
          setLoading(false);
          setIsProcessing(false);
          setProcessingSteps([]);
          setCurrentStep(0);
          
        } catch (error) {
          console.error('Processing error:', error);
          setError({
            title: 'File Processing Error',
            message: error.message,
            details: 'Please make sure you\'re uploading a valid Amazon Advertising bulk report.',
            canRetry: true
          });
          setLoading(false);
          setIsProcessing(false);
          setProcessingSteps([]);
          setCurrentStep(0);
        }
      };

      reader.onerror = () => {
        setError({
          title: 'File Read Error',
          message: 'Could not read the file. Please try again.',
          details: 'The file may be corrupted or in an unsupported format.',
          canRetry: true
        });
        setLoading(false);
        setIsProcessing(false);
        setProcessingSteps([]);
        setCurrentStep(0);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload error:', error);
      setError({
        title: 'Upload Error',
        message: error.message || 'An unexpected error occurred',
        details: 'Please try uploading the file again.',
        canRetry: true
      });
      setLoading(false);
      setIsProcessing(false);
      setProcessingSteps([]);
      setCurrentStep(0);
    }
  };


  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Clear any previous errors
    setError(null);
    setLoading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('The file appears to be empty or corrupted.');
          }
          
          let jsonData = [];
          let sheetFound = false;
          
          // Priority order: look for campaign/keyword sheets first
          const preferredSheetPatterns = [
            /sponsored.*products.*campaigns/i,
            /sponsored.*products/i,
            /campaigns/i,
            /search.*terms/i,
            /keywords/i,
            /targeting/i
          ];
          
          // Skip these sheets
          const skipSheetPatterns = [
            /portfolio/i,
            /summary/i,
            /overview/i
          ];
          
          // First try to find a preferred sheet
          for (let pattern of preferredSheetPatterns) {
            for (let sheetName of workbook.SheetNames) {
              if (pattern.test(sheetName)) {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                if (sheetData && sheetData.length > 0) {
                  jsonData = sheetData;
                  sheetFound = true;
                  console.log(`✓ Found ${sheetData.length} rows in preferred sheet: ${sheetName}`);
                  break;
                }
              }
            }
            if (sheetFound) break;
          }
          
          // If no preferred sheet found, take any sheet that's not in skip list
          if (!sheetFound) {
            for (let sheetName of workbook.SheetNames) {
              // Skip unwanted sheets
              if (skipSheetPatterns.some(pattern => pattern.test(sheetName))) {
                console.log(`✗ Skipping sheet: ${sheetName}`);
                continue;
              }
              
              const worksheet = workbook.Sheets[sheetName];
              const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
              if (sheetData && sheetData.length > 0) {
                jsonData = sheetData;
                sheetFound = true;
                console.log(`✓ Found ${sheetData.length} rows in sheet: ${sheetName}`);
                break;
              }
            }
          }
          
          if (!sheetFound || jsonData.length === 0) {
            throw new Error('No data found in the uploaded file. Please make sure your Excel file contains data and try again.');
          }
          
          // Log first row to help debug
          console.log('=== FILE PARSING DEBUG ===');
          console.log('Total rows found:', jsonData.length);
          console.log('Column names in file:', Object.keys(jsonData[0]));
          console.log('First row sample:', jsonData[0]);
          console.log('========================');
          
          setData(jsonData);
          const analysisResult = analyzeData(jsonData);
          
          if (!analysisResult) {
            throw new Error('Could not analyze the data. Please make sure your file has the correct column names (Campaign, Keyword, Spend, Sales, Clicks, Impressions, etc.)');
          }
          
          // Show name modal with default file name
          const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
          setPendingFileName(fileName);
          setAnalysisName(fileName);
          setShowNameModal(true);
          
          setLoading(false);
        } catch (parseError) {
          console.error('Parse error:', parseError);
          setError({
            title: 'File Processing Error',
            message: parseError.message,
            details: 'Please make sure you\'re uploading a valid Amazon Advertising bulk report.',
            canRetry: true
          });
          setLoading(false);
          setData(null);
          setAnalysis(null);
        }
      };
      
      reader.onerror = () => {
        setError({
          title: 'File Read Error',
          message: 'Could not read the file. Please try again.',
          details: 'The file may be corrupted or in an unsupported format.',
          canRetry: true
        });
        setLoading(false);
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload error:', error);
      setError({
        title: 'Upload Error',
        message: error.message || 'An unexpected error occurred',
        details: 'Please try uploading the file again.',
        canRetry: true
      });
      setLoading(false);
    }
  };

  const parseNumericValue = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    const cleaned = String(value).replace(/[$%,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getValue = (row, possibleKeys) => {
    // First try exact match (case-sensitive)
    for (let key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    
    // Then try case-insensitive match
    const rowKeysLower = Object.keys(row).reduce((acc, key) => {
      acc[key.toLowerCase()] = row[key];
      return acc;
    }, {});
    
    for (let key of possibleKeys) {
      const lowerKey = key.toLowerCase();
      const foundKey = Object.keys(rowKeysLower).find(k => k === lowerKey);
      if (foundKey && rowKeysLower[foundKey] !== undefined && rowKeysLower[foundKey] !== null && rowKeysLower[foundKey] !== '') {
        return rowKeysLower[foundKey];
      }
    }
    
    // Try partial match (contains)
    for (let key of possibleKeys) {
      const lowerKey = key.toLowerCase();
      const foundKey = Object.keys(row).find(k => k.toLowerCase().includes(lowerKey) || lowerKey.includes(k.toLowerCase()));
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    
    return '';
  };

  const deduplicateData = (data) => {
    console.log('=== DEDUPLICATION START ===');
    console.log('Input rows:', data.length);
    
    /* 
    CRITICAL INSIGHT from data analysis:
    Amazon reports the SAME spend multiple ways in the same file:
    
    Example Campaign with $2,091 spend shows:
    - Campaign row: $2,091 (ROLLUP)
    - Ad Group row: $2,091 (ROLLUP)  
    - Product Ad rows: $477 + $1,615 = $2,091 (GRANULAR breakdown)
    - Keyword rows: $109 + $1,983 = $2,091 (ALSO equals $2,091!)
    
    Product Ads and Keywords are DIFFERENT VIEWS of the SAME spend!
    If you add them, you double-count: $2,091 + $2,091 = $4,182 (WRONG!)
    
    Solution:
    1. Remove ALL rollup rows: Campaign, Ad Group, Bidding Adjustment
    2. For each campaign, keep ONLY ONE granular view:
       - Prefer Keywords (most granular for manual campaigns)
       - If no Keywords, use Product Targeting  
       - If neither, use Product Ads
    */
    
    const entityType = (row) => {
      return String(getValue(row, ['Entity', 'Record Type', 'Operation'])).trim();
    };
    
    const getCampaignId = (row) => {
      return String(getValue(row, ['Campaign ID', 'Campaign Id', 'CampaignId'])).trim();
    };
    
    // Step 1: Categorize rows
    const rollupEntities = new Set([
      'Campaign',
      'Ad Group',
      'AdGroup', 
      'Bidding Adjustment',
      'Bidding Adjustment by Placement',
      'Portfolio'
    ]);
    
    const granularEntities = {
      'Keyword': 3,                    // Highest priority (most granular)
      'Product Targeting': 2,           // Second priority
      'Product Ad': 1,                  // Lowest priority (least granular)
      'Product Collection Ad': 1,       // Sponsored Brands ads
      'Contextual Targeting': 2,        // Sponsored Display
      'Audience Targeting': 2,          // Sponsored Display
      'Search Term': 3,                 // Search term reports (most granular)
      'Customer Search Term': 3         // Search term reports
    };
    
    // Step 2: Group by campaign to find which granular type each campaign has
    const campaignData = new Map();
    
    data.forEach(row => {
      const campaignId = getCampaignId(row);
      const entity = entityType(row);
      
      if (!campaignId) return;
      
      if (!campaignData.has(campaignId)) {
        campaignData.set(campaignId, {
          rows: [],
          granularTypes: new Set()
        });
      }
      
      const campaign = campaignData.get(campaignId);
      campaign.rows.push(row);
      
      if (granularEntities[entity]) {
        campaign.granularTypes.add(entity);
      }
    });
    
    console.log('Campaigns found:', campaignData.size);
    
    // Step 3: For each campaign, determine which granular type to keep
    const deduplicatedRows = [];
    let rowsRemoved = 0;
    
    campaignData.forEach((campaign, campaignId) => {
      // Find the highest priority granular type this campaign has
      let selectedType = null;
      let highestPriority = 0;
      
      campaign.granularTypes.forEach(type => {
        if (granularEntities[type] > highestPriority) {
          highestPriority = granularEntities[type];
          selectedType = type;
        }
      });
      
      // Filter rows for this campaign
      campaign.rows.forEach(row => {
        const entity = entityType(row);
        
        // Remove rollup rows
        if (rollupEntities.has(entity)) {
          rowsRemoved++;
          return;
        }
        
        // Remove negative targeting rows (they have $0 spend)
        if (entity.toLowerCase().includes('negative')) {
          rowsRemoved++;
          return;
        }
        
        // If we have granular data, only keep the selected type
        if (selectedType) {
          if (entity === selectedType) {
            deduplicatedRows.push(row);
          } else if (granularEntities[entity]) {
            // This is a different granular type - skip it
            rowsRemoved++;
          } else {
            // Not a granular type we recognize - keep it
            deduplicatedRows.push(row);
          }
        } else {
          // No granular data - keep everything except rollups
          deduplicatedRows.push(row);
        }
      });
    });
    
    console.log('Output rows:', deduplicatedRows.length);
    console.log('Rows removed:', rowsRemoved);
    console.log('Reduction:', ((rowsRemoved / data.length) * 100).toFixed(1) + '%');
    console.log('=== DEDUPLICATION END ===');
    
    return deduplicatedRows;
  };

  const getAcosColor = (acos) => {
    if (acos === 0 || !acos) return 'text-gray-500';
    if (acos <= targetAcos) return 'text-green-600 font-bold';
    if (acos <= targetAcos * 1.25) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
  };

  const getRowBgColor = (acos) => {
    if (acos === 0 || !acos) return '';
    if (acos <= targetAcos) return 'bg-green-50';
    if (acos <= targetAcos * 1.25) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const analyzeData = (rawData) => {
    try {
      console.log('Starting analysis with', rawData.length, 'rows');
      
      const validData = rawData.filter(row => {
        const hasSpend = parseNumericValue(getValue(row, ['Spend', 'Cost', 'Ad Spend', 'Total Spend'])) > 0;
        const hasImpressions = parseNumericValue(getValue(row, ['Impressions', 'Impr.', 'Impr'])) > 0;
        const hasClicks = parseNumericValue(getValue(row, ['Clicks', 'Click'])) > 0;
        return hasSpend || hasImpressions || hasClicks;
      });
      
      console.log('Valid data rows (before deduplication):', validData.length);

      // DEDUPLICATION: Remove duplicate rows (daily/weekly/monthly summaries)
      const deduplicatedData = deduplicateData(validData);
      console.log('Valid data rows (after deduplication):', deduplicatedData.length);

      if (deduplicatedData.length === 0) {
        console.error('No valid data found after deduplication. First row:', rawData[0]);
        throw new Error('No valid advertising data found in the file. Please check that your file contains columns for Spend, Clicks, Impressions, and Sales.');
      }

      const totalSpend = deduplicatedData.reduce((sum, row) => sum + parseNumericValue(getValue(row, ['Spend', 'Cost', 'Ad Spend', 'Total Spend'])), 0);
      const totalSales = deduplicatedData.reduce((sum, row) => sum + parseNumericValue(getValue(row, ['Sales', 'Revenue', '7 Day Total Sales', 'Total Sales', 'Sales 7d'])), 0);
      const totalClicks = deduplicatedData.reduce((sum, row) => sum + parseNumericValue(getValue(row, ['Clicks', 'Click'])), 0);
      const totalImpressions = deduplicatedData.reduce((sum, row) => sum + parseNumericValue(getValue(row, ['Impressions', 'Impr.', 'Impr'])), 0);
      const totalOrders = deduplicatedData.reduce((sum, row) => sum + parseNumericValue(getValue(row, ['Orders', '7 Day Total Orders', 'Total Orders', 'Orders 7d'])), 0);
      
      console.log('Totals calculated:', { totalSpend, totalSales, totalClicks, totalImpressions, totalOrders });
    
    // Campaign analysis
    const campaignMap = new Map();
    deduplicatedData.forEach(row => {
      const campaignName = String(getValue(row, ['Campaign Name (Informational only)', 'Campaign Name', 'Campaign', 'Campaign name'])).trim() || 'Unknown';
      if (!campaignMap.has(campaignName)) {
        campaignMap.set(campaignName, { name: campaignName, spend: 0, sales: 0, clicks: 0, impressions: 0, orders: 0, rows: [] });
      }
      const campaign = campaignMap.get(campaignName);
      campaign.spend += parseNumericValue(getValue(row, ['Spend', 'Cost', 'Ad Spend', 'Total Spend']));
      campaign.sales += parseNumericValue(getValue(row, ['Sales', 'Revenue', '7 Day Total Sales', 'Total Sales', 'Sales 7d']));
      campaign.clicks += parseNumericValue(getValue(row, ['Clicks', 'Click']));
      campaign.impressions += parseNumericValue(getValue(row, ['Impressions', 'Impr.', 'Impr']));
      campaign.orders += parseNumericValue(getValue(row, ['Orders', '7 Day Total Orders', 'Total Orders', 'Orders 7d']));
      campaign.rows.push(row);
    });

    const campaigns = Array.from(campaignMap.values()).map(c => ({
      ...c,
      acos: c.spend > 0 && c.sales > 0 ? (c.spend / c.sales * 100) : 0,
      roas: c.spend > 0 ? (c.sales / c.spend) : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0,
      cpc: c.clicks > 0 ? (c.spend / c.clicks) : 0,
      cvr: c.clicks > 0 ? (c.orders / c.clicks * 100) : 0
    }));

    const autoVsManual = analyzeAutoVsManual(deduplicatedData);
    const matchTypeAnalysis = analyzeMatchTypes(deduplicatedData);
    const keywordAnalysis = analyzeKeywords(deduplicatedData);
    const wastedSpend = analyzeWastedSpend(deduplicatedData);
    const inefficientSpend = analyzeInefficientSpend(campaigns, keywordAnalysis, targetAcos);
    const recommendations = generateRecommendations(campaigns, keywordAnalysis, wastedSpend, inefficientSpend, targetAcos);

    const analysisObject = {
      metrics: {
        totalSpend: totalSpend.toFixed(2),
        totalSales: totalSales.toFixed(2),
        acos: totalSpend > 0 && totalSales > 0 ? ((totalSpend / totalSales) * 100).toFixed(2) : '0.00',
        roas: totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0.00',
        ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00',
        cpc: totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00',
        cvr: totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : '0.00',
        totalClicks: Math.round(totalClicks),
        totalImpressions: Math.round(totalImpressions),
        totalOrders: Math.round(totalOrders),
      },
      campaigns,
      autoVsManual,
      matchTypeAnalysis,
      keywordAnalysis,
      wastedSpend,
      inefficientSpend,
      recommendations,
      rawData: deduplicatedData
    };

    setAnalysis(analysisObject);
    return analysisObject;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
};

  const analyzeAutoVsManual = (data) => {
    const groups = { Auto: { spend: 0, clicks: 0, sales: 0, orders: 0, impressions: 0 }, 
                     Manual: { spend: 0, clicks: 0, sales: 0, orders: 0, impressions: 0 } };
    
    data.forEach(row => {
      const targetingType = String(getValue(row, ['Targeting Type', 'Match Type', 'Targeting'])).toLowerCase();
      const isAuto = targetingType.includes('auto') || targetingType.includes('close') || targetingType.includes('loose') || targetingType.includes('substitute') || targetingType.includes('complement');
      const type = isAuto ? 'Auto' : 'Manual';
      
      groups[type].spend += parseNumericValue(getValue(row, ['Spend', 'Cost', 'Ad Spend', 'Total Spend']));
      groups[type].sales += parseNumericValue(getValue(row, ['Sales', 'Revenue', '7 Day Total Sales', 'Total Sales', 'Sales 7d']));
      groups[type].clicks += parseNumericValue(getValue(row, ['Clicks', 'Click']));
      groups[type].orders += parseNumericValue(getValue(row, ['Orders', '7 Day Total Orders', 'Total Orders', 'Orders 7d']));
      groups[type].impressions += parseNumericValue(getValue(row, ['Impressions', 'Impr.', 'Impr']));
    });

    return Object.entries(groups).map(([name, metrics]) => ({
      name,
      ...metrics,
      acos: metrics.spend > 0 && metrics.sales > 0 ? (metrics.spend / metrics.sales * 100) : 0,
      roas: metrics.spend > 0 ? (metrics.sales / metrics.spend) : 0,
      cpc: metrics.clicks > 0 ? (metrics.spend / metrics.clicks) : 0,
      cvr: metrics.clicks > 0 ? (metrics.orders / metrics.clicks * 100) : 0,
      ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions * 100) : 0,
      percentSpend: 0
    })).filter(g => g.spend > 0).map((g, i, arr) => {
      const totalSpend = arr.reduce((sum, item) => sum + item.spend, 0);
      return { ...g, percentSpend: totalSpend > 0 ? (g.spend / totalSpend * 100) : 0 };
    });
  };

  const analyzeMatchTypes = (data) => {
    const matchTypes = {};
    
    data.forEach(row => {
      const matchType = String(getValue(row, ['Match Type', 'Product Targeting Expression'])).trim() || 'Unknown';
      if (!matchTypes[matchType]) {
        matchTypes[matchType] = { name: matchType, spend: 0, clicks: 0, sales: 0, orders: 0, impressions: 0 };
      }
      matchTypes[matchType].spend += parseNumericValue(getValue(row, ['Spend', 'Cost']));
      matchTypes[matchType].sales += parseNumericValue(getValue(row, ['Sales', 'Revenue']));
      matchTypes[matchType].clicks += parseNumericValue(getValue(row, ['Clicks']));
      matchTypes[matchType].orders += parseNumericValue(getValue(row, ['Orders']));
      matchTypes[matchType].impressions += parseNumericValue(getValue(row, ['Impressions']));
    });

    return Object.values(matchTypes).map(mt => ({
      ...mt,
      acos: mt.spend > 0 && mt.sales > 0 ? (mt.spend / mt.sales * 100) : 0,
      roas: mt.spend > 0 ? (mt.sales / mt.spend) : 0,
      cpc: mt.clicks > 0 ? (mt.spend / mt.clicks) : 0,
      cvr: mt.clicks > 0 ? (mt.orders / mt.clicks * 100) : 0,
      ctr: mt.impressions > 0 ? (mt.clicks / mt.impressions * 100) : 0
    }));
  };

  const analyzeKeywords = (data) => {
    const keywords = {};
    
    data.forEach(row => {
      const keyword = String(getValue(row, ['Customer Search Term', 'Keyword Text'])).trim().toLowerCase();
      if (!keyword || keyword === 'unknown') return;
      
      if (!keywords[keyword]) {
        keywords[keyword] = { 
          keyword, 
          spend: 0, 
          clicks: 0, 
          sales: 0, 
          orders: 0, 
          impressions: 0,
          campaigns: {}
        };
      }
      
      const campaignName = String(getValue(row, ['Campaign Name (Informational only)', 'Campaign Name'])).trim();
      const placement = String(getValue(row, ['Placement'])).trim() || 'Other';
      
      if (!keywords[keyword].campaigns[campaignName]) {
        keywords[keyword].campaigns[campaignName] = {
          name: campaignName,
          spend: 0,
          sales: 0,
          clicks: 0,
          orders: 0,
          impressions: 0,
          placements: {}
        };
      }
      
      if (!keywords[keyword].campaigns[campaignName].placements[placement]) {
        keywords[keyword].campaigns[campaignName].placements[placement] = {
          name: placement,
          spend: 0,
          sales: 0,
          clicks: 0,
          orders: 0
        };
      }
      
      const spend = parseNumericValue(getValue(row, ['Spend', 'Cost']));
      const sales = parseNumericValue(getValue(row, ['Sales', 'Revenue']));
      const clicks = parseNumericValue(getValue(row, ['Clicks']));
      const orders = parseNumericValue(getValue(row, ['Orders']));
      const impressions = parseNumericValue(getValue(row, ['Impressions']));
      
      keywords[keyword].spend += spend;
      keywords[keyword].sales += sales;
      keywords[keyword].clicks += clicks;
      keywords[keyword].orders += orders;
      keywords[keyword].impressions += impressions;
      
      keywords[keyword].campaigns[campaignName].spend += spend;
      keywords[keyword].campaigns[campaignName].sales += sales;
      keywords[keyword].campaigns[campaignName].clicks += clicks;
      keywords[keyword].campaigns[campaignName].orders += orders;
      keywords[keyword].campaigns[campaignName].impressions += impressions;
      
      keywords[keyword].campaigns[campaignName].placements[placement].spend += spend;
      keywords[keyword].campaigns[campaignName].placements[placement].sales += sales;
      keywords[keyword].campaigns[campaignName].placements[placement].clicks += clicks;
      keywords[keyword].campaigns[campaignName].placements[placement].orders += orders;
    });

    return Object.values(keywords).map(k => ({
      ...k,
      acos: k.spend > 0 && k.sales > 0 ? (k.spend / k.sales * 100) : 0,
      roas: k.spend > 0 ? (k.sales / k.spend) : 0,
      cpc: k.clicks > 0 ? (k.spend / k.clicks) : 0,
      cvr: k.clicks > 0 ? (k.orders / k.clicks * 100) : 0,
      ctr: k.impressions > 0 ? (k.clicks / k.impressions * 100) : 0,
      campaignList: Object.values(k.campaigns).map(c => ({
        ...c,
        acos: c.spend > 0 && c.sales > 0 ? (c.spend / c.sales * 100) : 0,
        roas: c.spend > 0 ? (c.sales / c.spend) : 0,
        cpc: c.clicks > 0 ? (c.spend / c.clicks) : 0,
        cvr: c.clicks > 0 ? (c.orders / c.clicks * 100) : 0,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0,
        placementList: Object.values(c.placements).map(p => ({
          ...p,
          acos: p.spend > 0 && p.sales > 0 ? (p.spend / p.sales * 100) : 0,
          roas: p.spend > 0 ? (p.sales / p.spend) : 0
        }))
      }))
    }));
  };

  const analyzeWastedSpend = (data) => {
    const wastedKeywords = [];
    
    const keywordGroups = {};
    data.forEach(row => {
      const keyword = String(getValue(row, ['Customer Search Term', 'Keyword Text'])).trim().toLowerCase();
      if (!keyword) return;
      
      if (!keywordGroups[keyword]) {
        keywordGroups[keyword] = { keyword, clicks: 0, orders: 0, spend: 0, matchType: getValue(row, ['Match Type']) };
      }
      keywordGroups[keyword].clicks += parseNumericValue(getValue(row, ['Clicks']));
      keywordGroups[keyword].orders += parseNumericValue(getValue(row, ['Orders']));
      keywordGroups[keyword].spend += parseNumericValue(getValue(row, ['Spend', 'Cost']));
    });

    Object.values(keywordGroups).forEach(kw => {
      if (kw.clicks >= 5 && kw.orders === 0 && kw.spend > 0) {
        wastedKeywords.push(kw);
      }
    });

    return {
      keywords: wastedKeywords.sort((a, b) => b.spend - a.spend),
      totalWasted: wastedKeywords.reduce((sum, k) => sum + k.spend, 0)
    };
  };

  const analyzeInefficientSpend = (campaigns, keywords, targetAcos) => {
    const threshold = targetAcos * 1.3;
    const inefficientItems = [];
    
    // Inefficient campaigns
    campaigns.forEach(c => {
      if (c.acos > threshold && c.spend > 50) {
        inefficientItems.push({
          type: 'campaign',
          name: c.name,
          spend: c.spend,
          sales: c.sales,
          acos: c.acos,
          roas: c.roas,
          orders: c.orders,
          clicks: c.clicks,
          cpc: c.cpc
        });
      }
    });
    
    // Inefficient keywords
    keywords.forEach(k => {
      if (k.acos > threshold && k.spend > 20) {
        inefficientItems.push({
          type: 'keyword',
          name: k.keyword,
          spend: k.spend,
          sales: k.sales,
          acos: k.acos,
          roas: k.roas,
          orders: k.orders,
          clicks: k.clicks,
          cpc: k.cpc
        });
      }
    });
    
    return {
      items: inefficientItems.sort((a, b) => b.spend - a.spend),
      totalInefficient: inefficientItems.reduce((sum, i) => sum + i.spend, 0)
    };
  };

  const generateRecommendations = (campaigns, keywords, wastedSpend, inefficientSpend, targetAcos) => {
    const recs = [];
    
    // Wasted spend recommendations
    if (wastedSpend.totalWasted > 100) {
      const topWasted = wastedSpend.keywords;
      recs.push({
        type: 'danger',
        title: `$${wastedSpend.totalWasted.toFixed(2)} Wasted on ${wastedSpend.keywords.length} Keywords (5+ Clicks, $0 Sales)`,
        description: 'Immediately add these search terms as negative keywords to stop wasting budget.',
        action: `Add ${wastedSpend.keywords.length} negative keywords`,
        details: topWasted.map(k => `• "${k.keyword}" - $${k.spend.toFixed(2)} wasted (${k.clicks} clicks)`),
        priority: 'high'
      });
    }

    // Inefficient spend recommendations
    if (inefficientSpend.totalInefficient > 100) {
      const inefficientCampaigns = inefficientSpend.items.filter(i => i.type === 'campaign');
      const inefficientKeywords = inefficientSpend.items.filter(i => i.type === 'keyword');
      
      if (inefficientCampaigns.length > 0) {
        recs.push({
          type: 'warning',
          title: `${inefficientCampaigns.length} Campaigns Over ${(targetAcos * 1.3).toFixed(1)}% ACoS (30% Above Target)`,
          description: `Target ACoS: ${targetAcos}%. These campaigns are significantly underperforming.`,
          action: 'Reduce bids by 20-30% or pause',
          details: inefficientCampaigns.map(c => `• "${c.name}" - ${c.acos.toFixed(2)}% ACoS, $${c.spend.toFixed(2)} spent. Lower bids to $${(c.cpc * 0.7).toFixed(2)} CPC`),
          priority: 'high'
        });
      }
      
      if (inefficientKeywords.length > 0) {
        // Group keywords by campaign for specific recommendations
        const keywordsByCampaign = {};
        inefficientKeywords.forEach(kw => {
          const keyword = keywords.find(k => k.keyword === kw.name);
          if (keyword && keyword.campaignList) {
            keyword.campaignList.forEach(camp => {
              if (!keywordsByCampaign[camp.name]) {
                keywordsByCampaign[camp.name] = [];
              }
              keywordsByCampaign[camp.name].push({
                keyword: kw.name,
                spend: camp.spend,
                acos: camp.acos,
                cpc: camp.cpc
              });
            });
          }
        });
        
        const campaignSpecificRecs = Object.entries(keywordsByCampaign).map(([campaignName, kws]) => {
          const topKw = kws.sort((a, b) => b.spend - a.spend).slice(0, 5);
          return `• Campaign "${campaignName}":\n  ${topKw.map(k => `Lower bid on "${k.keyword}" from $${k.cpc.toFixed(2)} to $${(k.cpc * 0.7).toFixed(2)} CPC`).join('\n  ')}`;
        });
        
        recs.push({
          type: 'warning',
          title: `${inefficientKeywords.length} Keywords Over ${(targetAcos * 1.3).toFixed(1)}% ACoS`,
          description: `These keywords are 30%+ above your ${targetAcos}% target. Lower bids or add as negative keywords.`,
          action: 'Reduce keyword-level bids by 30%',
          details: campaignSpecificRecs,
          priority: 'high'
        });
      }
    }

    // Top performers to scale
    const topPerformers = keywords.filter(k => k.acos > 0 && k.acos <= targetAcos * 0.8 && k.orders >= 3 && k.spend > 20).sort((a, b) => b.roas - a.roas);
    if (topPerformers.length > 0) {
      recs.push({
        type: 'success',
        title: `${topPerformers.length} High-Performing Keywords Below ${(targetAcos * 0.8).toFixed(1)}% ACoS`,
        description: `These keywords are performing 20%+ better than your ${targetAcos}% target. Scale them!`,
        action: 'Increase bids by 30-50%',
        details: topPerformers.map(k => {
          const topCampaign = k.campaignList.sort((a, b) => b.spend - a.spend)[0];
          return `• "${k.keyword}" in "${topCampaign.name}" - ${k.acos.toFixed(2)}% ACoS, ${k.roas.toFixed(2)}x ROAS. Increase bid from $${topCampaign.cpc.toFixed(2)} to $${(topCampaign.cpc * 1.4).toFixed(2)}`;
        }),
        priority: 'high'
      });
    }

    // Low conversion rate warnings
    const lowCvrKeywords = keywords.filter(k => k.cvr < 5 && k.clicks > 20 && k.spend > 30);
    if (lowCvrKeywords.length > 0) {
      recs.push({
        type: 'info',
        title: `${lowCvrKeywords.length} Keywords with Low Conversion Rate (<5%)`,
        description: 'These keywords get clicks but rarely convert. Review product-keyword relevance or landing page.',
        details: lowCvrKeywords.map(k => `• "${k.keyword}" - ${k.cvr.toFixed(2)}% CVR, ${k.clicks} clicks, ${k.orders} orders`),
        priority: 'medium'
      });
    }

    return recs;
  };

  // Export function
  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  // Sort function
  const sortData = (data, sortConfig) => {
    if (!sortConfig.column) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];
      
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const handleSort = (column, currentSort, setSort) => {
    setSort({
      column,
      direction: currentSort.column === column && currentSort.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const toggleCampaign = (campaignName) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignName)) {
      newExpanded.delete(campaignName);
    } else {
      newExpanded.add(campaignName);
    }
    setExpandedCampaigns(newExpanded);
  };

  const toggleKeyword = (keyword) => {
    const newExpanded = new Set(expandedKeywords);
    if (newExpanded.has(keyword)) {
      newExpanded.delete(keyword);
    } else {
      newExpanded.add(keyword);
    }
    setExpandedKeywords(newExpanded);
  };

  const getCampaignDetails = (campaign) => {
    const keywords = {};
    const placements = {};
    
    campaign.rows.forEach(row => {
      const keyword = String(getValue(row, ['Customer Search Term', 'Keyword Text'])).trim() || 'N/A';
      const placement = String(getValue(row, ['Placement'])).trim() || 'Other';
      
      if (!keywords[keyword]) {
        keywords[keyword] = { keyword, spend: 0, sales: 0, clicks: 0, orders: 0, impressions: 0 };
      }
      keywords[keyword].spend += parseNumericValue(getValue(row, ['Spend', 'Cost']));
      keywords[keyword].sales += parseNumericValue(getValue(row, ['Sales', 'Revenue']));
      keywords[keyword].clicks += parseNumericValue(getValue(row, ['Clicks']));
      keywords[keyword].orders += parseNumericValue(getValue(row, ['Orders']));
      keywords[keyword].impressions += parseNumericValue(getValue(row, ['Impressions']));
      
      if (!placements[placement]) {
        placements[placement] = { placement, spend: 0, sales: 0, clicks: 0, orders: 0, impressions: 0 };
      }
      placements[placement].spend += parseNumericValue(getValue(row, ['Spend', 'Cost']));
      placements[placement].sales += parseNumericValue(getValue(row, ['Sales', 'Revenue']));
      placements[placement].clicks += parseNumericValue(getValue(row, ['Clicks']));
      placements[placement].orders += parseNumericValue(getValue(row, ['Orders']));
      placements[placement].impressions += parseNumericValue(getValue(row, ['Impressions']));
    });

    return {
      keywords: Object.values(keywords).map(k => ({
        ...k,
        acos: k.spend > 0 && k.sales > 0 ? (k.spend / k.sales * 100) : 0,
        roas: k.spend > 0 ? (k.sales / k.spend) : 0,
        cpc: k.clicks > 0 ? (k.spend / k.clicks) : 0,
        cvr: k.clicks > 0 ? (k.orders / k.clicks * 100) : 0,
        ctr: k.impressions > 0 ? (k.clicks / k.impressions * 100) : 0
      })).sort((a, b) => b.spend - a.spend),
      placements: Object.values(placements).map(p => ({
        ...p,
        acos: p.spend > 0 && p.sales > 0 ? (p.spend / p.sales * 100) : 0,
        roas: p.spend > 0 ? (p.sales / p.spend) : 0,
        cpc: p.clicks > 0 ? (p.spend / p.clicks) : 0,
        cvr: p.clicks > 0 ? (p.orders / p.clicks * 100) : 0,
        ctr: p.impressions > 0 ? (p.clicks / p.impressions * 100) : 0
      })).sort((a, b) => b.spend - a.spend)
    };
  };

  const filteredKeywords = useMemo(() => {
    if (!analysis) return [];
    
    return analysis.keywordAnalysis.filter(k => {
      const matchesSearch = k.keyword.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMinClicks = k.clicks >= minClicks;
      return matchesSearch && matchesMinClicks;
    });
  }, [analysis, searchTerm, minClicks]);

  // Re-analyze when target ACoS changes
  React.useEffect(() => {
    if (data && analysis) {
      analyzeData(data);
    }
  }, [targetAcos]);

  // Instruction Page
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Amazon PPC Analyzer</h1>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-8">
          <h2 className="text-3xl font-bold mb-8">Upload Your Amazon PPC Data</h2>

          <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={uploadAnalysisName}
                onChange={(e) => setUploadAnalysisName(e.target.value)}
                placeholder="e.g., Brand Name - November 2024"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">Give this analysis a name to help you find it later</p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">How to Export Your Data from Amazon</h3>
                  <p className="text-sm text-gray-600">Follow these steps to download the correct data file:</p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-bold text-gray-900 mb-1">Step 1: Go to Amazon Advertising Console</p>
                  <p className="text-gray-700">Log into your Amazon Seller Central account and navigate to the Advertising section.</p>
                </div>

                <div>
                  <p className="font-bold text-gray-900 mb-1">Step 2: Access Bulk Operations</p>
                  <p className="text-gray-700">Click on <strong>Bulk Operations</strong> in the left sidebar or top menu.</p>
                </div>

                <div>
                  <p className="font-bold text-gray-900 mb-1">Step 3: Download Bulk Sheet</p>
                  <p className="text-gray-700">Select "Download Bulk Sheet" and choose your time range (Last 60 days recommended).</p>
                </div>

                <div>
                  <p className="font-bold text-gray-900 mb-1">Step 4: Select Required Data Types</p>
                  <p className="text-gray-700 mb-2">Make sure to select <strong>at least these boxes</strong>:</p>
                  <div className="bg-white rounded-lg p-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Sponsored Products: Targeting and Keyword Filter: Enabled & Paused</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Paused Campaigns</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Placement Data for Campaigns</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Sponsored Products Data</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Sponsored Brands Multi-ad group data</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Sponsored Display Data</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Sponsored Products Search Term Data</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Sponsored Brands Search Term Data</span>
                    </label>
                  </div>
                </div>

                <div>
                  <p className="font-bold text-gray-900 mb-1">Step 5: Download & Upload Here</p>
                  <p className="text-gray-700">Click "Download" and save the Excel file (.xlsx). Then upload it below!</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleInstructionFileUpload}
                className="hidden"
                id="instructionFileInput"
              />
              <label
                htmlFor="instructionFileInput"
                className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg transition cursor-pointer ${
                  uploadAnalysisName.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Upload className="w-6 h-6" />
                Choose Your Excel File
              </label>
              {!uploadAnalysisName.trim() && (
                <p className="text-sm text-red-600 mt-2">Please enter an analysis name first</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                <strong>Your data is analyzed locally in your browser</strong> - we never store it on our servers
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Processing Modal
  if (isProcessing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center mb-6">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">Analyzing Your Data</h2>
            <p className="text-gray-600 mt-2">Please wait while we process your file...</p>
          </div>

          <div className="space-y-3">
            {processingSteps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg transition ${
                  index < currentStep
                    ? 'bg-green-50 border-2 border-green-200'
                    : index === currentStep
                    ? 'bg-blue-50 border-2 border-blue-400 animate-pulse'
                    : 'bg-gray-50 border-2 border-gray-200'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : index === currentStep ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${
                  index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${(currentStep / processingSteps.length) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">
              {currentStep} of {processingSteps.length} steps complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
              <AlertTriangle className="w-16 h-16 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{error.title || 'Error'}</h1>
            <p className="text-xl text-red-600 font-semibold mb-4">{error.message}</p>
            {error.details && (
              <p className="text-gray-600 mb-6">{error.details}</p>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3">Troubleshooting Tips:</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Make sure you're uploading an Amazon Advertising bulk report (Excel file)</li>
              <li>• The file should contain columns like: Campaign Name, Keyword, Spend, Sales, Clicks, Impressions</li>
              <li>• Check that the file is not empty and contains actual data rows</li>
              <li>• Try downloading a fresh report from Amazon and uploading again</li>
            </ul>
          </div>

          <div className="space-y-3">
            {error.canRetry && (
              <button
                onClick={() => {
                  setError(null);
                  setCurrentPage('account');
                }}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Try Another File
              </button>
            )}
            
            <button
              onClick={() => {
                setError(null);
                setData(null);
                setAnalysis(null);
                setCurrentPage(isAuthenticated ? 'account' : 'landing');
              }}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back to {isAuthenticated ? 'Dashboard' : 'Home'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              Need help? Check the browser console (F12) for more technical details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Landing Page
  if (currentPage === 'landing') {
    return (
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <header className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold">PPC Analyzer Pro</div>
            <button
              onClick={() => setCurrentPage('auth')}
              className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Login / Sign Up
            </button>
          </nav>
          
          <div className="max-w-7xl mx-auto px-6 py-20 text-center">
            <h1 className="text-5xl font-bold mb-6">Transform Your Amazon PPC Performance</h1>
            <p className="text-xl mb-8 text-blue-100 max-w-3xl mx-auto">
              Professional-grade campaign analysis and optimization. Identify wasted spend, boost ROI, and scale winning campaigns with data-driven insights.
            </p>
            <button
              onClick={() => setCurrentPage('auth')}
              className="bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-gray-100 transition shadow-lg"
            >
              Start Free Analysis →
            </button>
            <div className="mt-6 flex items-center justify-center gap-2 text-blue-100">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">100% Private • No Data Collection • Locally Stored</span>
            </div>
          </div>
        </header>

        {/* Benefits Section */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Why PPC Analyzer Pro?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Stop Wasted Spend</h3>
              <p className="text-gray-600">Instantly identify keywords with 5+ clicks and $0 in sales. Save thousands by eliminating campaigns that don't convert.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Scale Winners</h3>
              <p className="text-gray-600">Discover high-performing campaigns below your target ACoS. Get specific recommendations on where to increase bids.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Hit Your Targets</h3>
              <p className="text-gray-600">Set custom ACoS targets and see exactly which campaigns need optimization. Color-coded metrics make decisions effortless.</p>
            </div>
          </div>
        </section>

        {/* Dashboard Preview */}
        <section className="bg-gray-50 py-20">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-4xl font-bold text-center mb-4 text-gray-900">Comprehensive Dashboard Analytics</h2>
            <p className="text-center text-gray-600 mb-12 text-lg">Upload your Amazon Advertising data and get instant insights</p>
            
            <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-8">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <BarChart className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 flex-shrink-0" />
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold">Campaign Performance Overview</h3>
              </div>
              <div className="border-2 border-gray-200 rounded-lg p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-white">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Spend</div>
                    <div className="text-lg sm:text-2xl font-bold text-red-600">$12,453</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Sales</div>
                    <div className="text-lg sm:text-2xl font-bold text-green-600">$54,210</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">ACoS</div>
                    <div className="text-lg sm:text-2xl font-bold text-blue-600">23.0%</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-white rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">ROAS</div>
                    <div className="text-lg sm:text-2xl font-bold text-purple-600">4.35x</div>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 text-center">Real-time metrics updated as you upload new data</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-xl font-bold">Wasted Spend Detection</h3>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                  <div className="text-3xl font-bold text-red-600 mb-2">$2,847.50</div>
                  <div className="text-sm text-gray-700">127 keywords with 5+ clicks, $0 sales</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Automatically identifies non-converting keywords</li>
                  <li>• One-click export for bulk negating</li>
                  <li>• Sorted by highest spend first</li>
                </ul>
              </div>

              <div className="bg-white rounded-xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-xl font-bold">Inefficient Campaigns</h3>
                </div>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="text-3xl font-bold text-yellow-600 mb-2">$4,123.20</div>
                  <div className="text-sm text-gray-700">23 items over 30% above target ACoS</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Bid reduction recommendations</li>
                  <li>• Compare campaign vs keyword performance</li>
                  <li>• Custom ACoS threshold settings</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Powerful Features</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Advanced Sorting & Filtering</h3>
                <p className="text-gray-600">Sort by spend, ACoS, ROAS, or any metric. Filter by match type, minimum clicks, and search terms.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Expandable Campaign Views</h3>
                <p className="text-gray-600">Drill down into each campaign to see keywords, placements, and performance by targeting type.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Excel Export</h3>
                <p className="text-gray-600">Export any table to Excel with one click. Perfect for sharing with your team or clients.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Match Type Analysis</h3>
                <p className="text-gray-600">Compare broad, phrase, and exact match performance. Optimize your targeting strategy.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Actionable Recommendations</h3>
                <p className="text-gray-600">Get specific, prioritized actions to improve performance based on your data.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Saved Analysis History</h3>
                <p className="text-gray-600">Store multiple analyses and track performance over time. Access previous audits anytime.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Security Section */}
        <section className="bg-green-50 py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">Your Data is 100% Private & Secure</h2>
                <p className="text-lg text-gray-600">We take your privacy seriously. Here's our commitment to you:</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg mb-2">Zero Data Collection</h3>
                      <p className="text-gray-600 text-sm">We don't collect, store, or transmit your advertising data to any servers. Everything stays on your device.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg mb-2">Local Storage Only</h3>
                      <p className="text-gray-600 text-sm">All analysis and data is stored locally in your browser. Only you have access to your information.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg mb-2">No Third-Party Sharing</h3>
                      <p className="text-gray-600 text-sm">Your campaign data is never shared, sold, or transmitted to any third parties. Period.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg mb-2">You Control Your Data</h3>
                      <p className="text-gray-600 text-sm">Delete your analyses anytime. Clear your browser data, and it's gone forever. You're in complete control.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-green-500 rounded-xl p-6 text-center">
                <p className="text-gray-700 font-semibold mb-2">🔒 100% Client-Side Processing</p>
                <p className="text-sm text-gray-600">
                  This tool runs entirely in your web browser. Your sensitive Amazon advertising data never leaves your computer. 
                  No uploads to external servers, no cloud storage, no data tracking. Just secure, private analysis.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-20">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Optimize Your Campaigns?</h2>
            <p className="text-xl mb-8 text-blue-100">
              Join hundreds of sellers saving thousands on wasted ad spend
            </p>
            <button
              onClick={() => setCurrentPage('auth')}
              className="bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-gray-100 transition shadow-lg"
            >
              Get Started Free →
            </button>
            <p className="mt-6 text-sm text-blue-100">No credit card required • Upload your data in seconds</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-6">
              <p className="text-lg font-semibold text-white mb-2">🔒 Privacy-First Amazon PPC Analysis</p>
              <p className="text-gray-400">Your data is stored locally in your browser and never shared with anyone.</p>
            </div>
            <div className="border-t border-gray-800 pt-6 text-center text-sm">
              <p>© 2024 PPC Analyzer Pro. No data collection • No tracking • No external servers</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Auth Page
  if (currentPage === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <button
            onClick={() => setCurrentPage('landing')}
            className="mb-4 text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-2"
          >
            ← Back to Home
          </button>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Amazon PPC Analyzer</h1>
            <p className="text-gray-600">Professional campaign optimization tool</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex border-b mb-6">
              <button
                onClick={() => {
                  setShowLogin(true);
                  setAuthError('');
                }}
                className={`flex-1 pb-4 font-semibold transition ${
                  showLogin 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setShowLogin(false);
                  setAuthError('');
                  setMarketingConsent(true);
                }}
                className={`flex-1 pb-4 font-semibold transition ${
                  !showLogin 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                {authError}
              </div>
            )}

            <form onSubmit={showLogin ? handleLogin : handleSignup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>

              {!showLogin && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              {!showLogin && (
                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900 block mb-1">
                          Yes, send me helpful updates and tips
                        </span>
                        <p className="text-xs text-gray-600">
                          Get occasional emails with PPC optimization tips, new features, and exclusive insights. 
                          <span className="font-semibold"> We respect your inbox</span> - no spam, unsubscribe anytime.
                        </p>
                      </div>
                    </label>
                  </div>
                  {!marketingConsent && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      This checkbox is required to create an account
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                {showLogin ? 'Login' : 'Create Account'}
              </button>
            </form>

            {showLogin && (
              <p className="text-center text-sm text-gray-600 mt-6">
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setShowLogin(false);
                    setAuthError('');
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Sign up
                </button>
              </p>
            )}
            {!showLogin && (
              <p className="text-center text-sm text-gray-600 mt-6">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setShowLogin(true);
                    setAuthError('');
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Login
                </button>
              </p>
            )}
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">🔒 Your Data is Secure</p>
                <p className="text-xs text-gray-600">
                  All data is encrypted and securely stored in the cloud. Your analyses are accessible from any device. 
                  Protected by industry-standard security and row-level access controls.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            Cloud-based storage • Access your analyses anywhere
          </p>
        </div>
      </div>
    );
  }

  // Account Page
  if (currentPage === 'account' && isAuthenticated) {
    const userAnalyses = savedAnalyses;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">My Account</h1>
              <p className="text-gray-600 mt-2">{email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center cursor-pointer hover:shadow-xl transition"
                 onClick={startNewAnalysis}>
              <Upload className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
              <h2 className="text-2xl font-bold mb-2">Create New Analysis</h2>
              <p className="text-gray-600">Upload Amazon PPC data to start a new audit</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <BarChart className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-bold mb-2">{userAnalyses.length} Saved Analyses</h2>
              <p className="text-gray-600">Access your previous campaign audits</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Previous Analyses</h2>
            {userAnalyses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No analyses yet</p>
                <p className="text-sm mt-2">Create your first analysis to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userAnalyses.sort((a, b) => new Date(b.date) - new Date(a.date)).map((analysis) => (
                  <div key={analysis.id} className="border rounded-lg p-4 hover:shadow-md transition flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{analysis.name}</h3>
                      <p className="text-sm text-gray-600">
                        Created: {new Date(analysis.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-gray-600">Spend: ${analysis.analysis?.metrics?.totalSpend || '0'}</span>
                        <span className="text-gray-600">Sales: ${analysis.analysis?.metrics?.totalSales || '0'}</span>
                        <span className="text-gray-600">ACoS: {analysis.analysis?.metrics?.acos || '0'}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadAnalysis(analysis.id)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this analysis?')) {
                            deleteAnalysis(analysis.id);
                          }
                        }}
                        className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // File Upload Page (when starting new analysis)
  if (currentPage === 'analysis' && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setCurrentPage('account')}
            className="mb-6 text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-2"
          >
            ← Back to Account
          </button>
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Amazon PPC Performance Analyzer</h1>
            <p className="text-lg text-gray-600">Professional campaign optimization tool</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-2xl mx-auto">
            <Upload className="w-20 h-20 mx-auto mb-6 text-indigo-500" />
            <h2 className="text-2xl font-semibold mb-4">Upload Your PPC Data</h2>
            <p className="text-gray-600 mb-8">Excel files (.xlsx, .xls) from Amazon Advertising</p>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <div className="bg-indigo-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-indigo-700 transition inline-block">
                Choose File
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  }

  const SortableHeader = ({ children, column, currentSort, setSortFunc }) => (
    <th 
      className="text-left p-2 cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(column, currentSort, setSortFunc)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </div>
    </th>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PPC Performance Dashboard</h1>
            <p className="text-gray-600">{analysis.rawData.length} rows analyzed • Target ACoS: {targetAcos}% • {email}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage('account')}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Home
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="bg-gray-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-gray-700 transition flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <div className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2">
                <Upload className="w-5 h-5" />
                New File
              </div>
            </label>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Analysis Name Modal */}
        {showNameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Name Your Analysis</h2>
              <p className="text-gray-600 mb-4">Give this analysis a memorable name</p>
              <input
                type="text"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
                placeholder="e.g., Q4 Campaign Analysis"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    confirmAnalysisName();
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={confirmAnalysisName}
                  className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  Save Analysis
                </button>
                <button
                  onClick={cancelAnalysisName}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Settings</h3>
            <div className="flex items-center gap-4">
              <label className="font-medium">Target ACoS (%):</label>
              <input
                type="number"
                value={targetAcos}
                onChange={(e) => setTargetAcos(parseFloat(e.target.value) || 20)}
                className="border-2 rounded px-4 py-2 w-24 font-bold text-lg"
                step="1"
                min="1"
                max="100"
              />
              <span className="text-gray-600">
                Color coding: <span className="text-green-600 font-bold">≤{targetAcos}%</span> | 
                <span className="text-yellow-600 font-bold"> {targetAcos}%-{(targetAcos * 1.25).toFixed(1)}%</span> | 
                <span className="text-red-600 font-bold"> &gt;{(targetAcos * 1.25).toFixed(1)}%</span>
              </span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-6 p-1 flex gap-1 overflow-x-auto">
          {['overview', 'campaigns', 'keywords', 'wasted-spend', 'inefficient-spend', 'recommendations'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded font-medium whitespace-nowrap ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="Total Spend" value={`$${analysis.metrics.totalSpend}`} />
              <MetricCard title="Total Sales" value={`$${analysis.metrics.totalSales}`} />
              <MetricCard title="ACoS" value={`${analysis.metrics.acos}%`} color={getAcosColor(parseFloat(analysis.metrics.acos))} />
              <MetricCard title="ROAS" value={`${analysis.metrics.roas}x`} />
              <MetricCard title="CTR" value={`${analysis.metrics.ctr}%`} />
              <MetricCard title="CPC" value={`$${analysis.metrics.cpc}`} />
              <MetricCard title="CVR" value={`${analysis.metrics.cvr}%`} />
              <MetricCard title="Orders" value={analysis.metrics.totalOrders} />
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Auto vs. Manual Campaigns</h2>
                <button
                  onClick={() => exportToExcel(analysis.autoVsManual, 'auto-vs-manual')}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Spend</th>
                      <th className="text-right p-2">Sales</th>
                      <th className="text-right p-2">Orders</th>
                      <th className="text-right p-2">ACoS</th>
                      <th className="text-right p-2">ROAS</th>
                      <th className="text-right p-2">CVR</th>
                      <th className="text-right p-2">CTR</th>
                      <th className="text-right p-2">CPC</th>
                      <th className="text-right p-2">% of Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.autoVsManual.map((row, idx) => (
                      <tr key={idx} className={`border-b ${getRowBgColor(row.acos)}`}>
                        <td className="p-2 font-medium">{row.name}</td>
                        <td className="text-right p-2">${row.spend.toFixed(2)}</td>
                        <td className="text-right p-2">${row.sales.toFixed(2)}</td>
                        <td className="text-right p-2">{row.orders}</td>
                        <td className={`text-right p-2 ${getAcosColor(row.acos)}`}>{row.acos.toFixed(2)}%</td>
                        <td className="text-right p-2">{row.roas.toFixed(2)}x</td>
                        <td className="text-right p-2">{row.cvr.toFixed(2)}%</td>
                        <td className="text-right p-2">{row.ctr.toFixed(2)}%</td>
                        <td className="text-right p-2">${row.cpc.toFixed(2)}</td>
                        <td className="text-right p-2 font-bold">{row.percentSpend.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Performance by Match Type</h2>
                <button
                  onClick={() => exportToExcel(sortData(analysis.matchTypeAnalysis, matchTypeSort), 'match-types')}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortableHeader column="name" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>Match Type</SortableHeader>
                      <SortableHeader column="spend" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>Spend</SortableHeader>
                      <SortableHeader column="sales" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>Sales</SortableHeader>
                      <SortableHeader column="orders" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>Orders</SortableHeader>
                      <SortableHeader column="acos" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>ACoS</SortableHeader>
                      <SortableHeader column="roas" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>ROAS</SortableHeader>
                      <SortableHeader column="cvr" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>CVR</SortableHeader>
                      <SortableHeader column="ctr" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>CTR</SortableHeader>
                      <SortableHeader column="cpc" currentSort={matchTypeSort} setSortFunc={setMatchTypeSort}>CPC</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(analysis.matchTypeAnalysis, matchTypeSort)
                      .slice((matchTypeCurrentPage - 1) * matchTypeRowsPerPage, matchTypeCurrentPage * matchTypeRowsPerPage)
                      .map((row, idx) => (
                      <tr key={idx} className={`border-b hover:bg-gray-50 ${getRowBgColor(row.acos)}`}>
                        <td className="p-2 font-medium">{row.name}</td>
                        <td className="text-right p-2">${row.spend.toFixed(2)}</td>
                        <td className="text-right p-2">${row.sales.toFixed(2)}</td>
                        <td className="text-right p-2">{row.orders}</td>
                        <td className={`text-right p-2 ${getAcosColor(row.acos)}`}>{row.acos.toFixed(2)}%</td>
                        <td className="text-right p-2">{row.roas.toFixed(2)}x</td>
                        <td className="text-right p-2">{row.cvr.toFixed(2)}%</td>
                        <td className="text-right p-2">{row.ctr.toFixed(2)}%</td>
                        <td className="text-right p-2">${row.cpc.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Rows per page:</label>
                  <select 
                    value={matchTypeRowsPerPage} 
                    onChange={(e) => {
                      setMatchTypeRowsPerPage(Number(e.target.value));
                      setMatchTypeCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {matchTypeCurrentPage} of {Math.ceil(sortData(analysis.matchTypeAnalysis, matchTypeSort).length / matchTypeRowsPerPage)}
                  </span>
                  <button
                    onClick={() => setMatchTypeCurrentPage(Math.max(1, matchTypeCurrentPage - 1))}
                    disabled={matchTypeCurrentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setMatchTypeCurrentPage(Math.min(Math.ceil(sortData(analysis.matchTypeAnalysis, matchTypeSort).length / matchTypeRowsPerPage), matchTypeCurrentPage + 1))}
                    disabled={matchTypeCurrentPage >= Math.ceil(sortData(analysis.matchTypeAnalysis, matchTypeSort).length / matchTypeRowsPerPage)}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Campaign Performance</h2>
              <button
                onClick={() => exportToExcel(sortData(analysis.campaigns, campaignSort), 'campaigns')}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 w-8"></th>
                    <SortableHeader column="name" currentSort={campaignSort} setSortFunc={setCampaignSort}>Campaign</SortableHeader>
                    <SortableHeader column="spend" currentSort={campaignSort} setSortFunc={setCampaignSort}>Spend</SortableHeader>
                    <SortableHeader column="sales" currentSort={campaignSort} setSortFunc={setCampaignSort}>Sales</SortableHeader>
                    <SortableHeader column="orders" currentSort={campaignSort} setSortFunc={setCampaignSort}>Orders</SortableHeader>
                    <SortableHeader column="clicks" currentSort={campaignSort} setSortFunc={setCampaignSort}>Clicks</SortableHeader>
                    <SortableHeader column="acos" currentSort={campaignSort} setSortFunc={setCampaignSort}>ACoS</SortableHeader>
                    <SortableHeader column="roas" currentSort={campaignSort} setSortFunc={setCampaignSort}>ROAS</SortableHeader>
                    <SortableHeader column="cvr" currentSort={campaignSort} setSortFunc={setCampaignSort}>CVR</SortableHeader>
                    <SortableHeader column="ctr" currentSort={campaignSort} setSortFunc={setCampaignSort}>CTR</SortableHeader>
                    <SortableHeader column="cpc" currentSort={campaignSort} setSortFunc={setCampaignSort}>CPC</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {sortData(analysis.campaigns, campaignSort)
                    .slice((campaignCurrentPage - 1) * campaignRowsPerPage, campaignCurrentPage * campaignRowsPerPage)
                    .map((campaign, idx) => {
                    const isExpanded = expandedCampaigns.has(campaign.name);
                    const details = isExpanded ? getCampaignDetails(campaign) : null;
                    
                    return (
                      <React.Fragment key={idx}>
                        <tr className={`border-b hover:bg-gray-50 ${getRowBgColor(campaign.acos)}`}>
                          <td className="p-2">
                            <button onClick={() => toggleCampaign(campaign.name)} className="text-gray-600 hover:text-gray-900">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="p-2 font-medium max-w-xs truncate">{campaign.name}</td>
                          <td className="text-right p-2">${campaign.spend.toFixed(2)}</td>
                          <td className="text-right p-2">${campaign.sales.toFixed(2)}</td>
                          <td className="text-right p-2">{campaign.orders}</td>
                          <td className="text-right p-2">{campaign.clicks}</td>
                          <td className={`text-right p-2 ${getAcosColor(campaign.acos)}`}>{campaign.acos.toFixed(2)}%</td>
                          <td className="text-right p-2">{campaign.roas.toFixed(2)}x</td>
                          <td className="text-right p-2">{campaign.cvr.toFixed(2)}%</td>
                          <td className="text-right p-2">{campaign.ctr.toFixed(2)}%</td>
                          <td className="text-right p-2">${campaign.cpc.toFixed(2)}</td>
                        </tr>
                        {isExpanded && details && (
                          <tr>
                            <td colSpan="11" className="p-4 bg-gray-50">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-bold mb-2 flex items-center justify-between">
                                    <span>Keywords in this Campaign</span>
                                    <button
                                      onClick={() => exportToExcel(details.keywords, `${campaign.name}-keywords`)}
                                      className="text-sm flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                                    >
                                      <Download className="w-3 h-3" />
                                      Export
                                    </button>
                                  </h4>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left p-1">Keyword</th>
                                        <th className="text-right p-1">Spend</th>
                                        <th className="text-right p-1">Sales</th>
                                        <th className="text-right p-1">Orders</th>
                                        <th className="text-right p-1">Clicks</th>
                                        <th className="text-right p-1">ACoS</th>
                                        <th className="text-right p-1">ROAS</th>
                                        <th className="text-right p-1">CVR</th>
                                        <th className="text-right p-1">CTR</th>
                                        <th className="text-right p-1">CPC</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {details.keywords.slice(0, 20).map((kw, i) => (
                                        <tr key={i} className={`border-b ${getRowBgColor(kw.acos)}`}>
                                          <td className="p-1">{kw.keyword}</td>
                                          <td className="text-right p-1">${kw.spend.toFixed(2)}</td>
                                          <td className="text-right p-1">${kw.sales.toFixed(2)}</td>
                                          <td className="text-right p-1">{kw.orders}</td>
                                          <td className="text-right p-1">{kw.clicks}</td>
                                          <td className={`text-right p-1 ${getAcosColor(kw.acos)}`}>{kw.acos > 0 ? `${kw.acos.toFixed(2)}%` : '-'}</td>
                                          <td className="text-right p-1">{kw.roas > 0 ? `${kw.roas.toFixed(2)}x` : '-'}</td>
                                          <td className="text-right p-1">{kw.cvr.toFixed(2)}%</td>
                                          <td className="text-right p-1">{kw.ctr.toFixed(2)}%</td>
                                          <td className="text-right p-1">${kw.cpc.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div>
                                  <h4 className="font-bold mb-2 flex items-center justify-between">
                                    <span>Placements</span>
                                    <button
                                      onClick={() => exportToExcel(details.placements, `${campaign.name}-placements`)}
                                      className="text-sm flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                                    >
                                      <Download className="w-3 h-3" />
                                      Export
                                    </button>
                                  </h4>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left p-1">Placement</th>
                                        <th className="text-right p-1">Spend</th>
                                        <th className="text-right p-1">Sales</th>
                                        <th className="text-right p-1">Orders</th>
                                        <th className="text-right p-1">Clicks</th>
                                        <th className="text-right p-1">ACoS</th>
                                        <th className="text-right p-1">ROAS</th>
                                        <th className="text-right p-1">CVR</th>
                                        <th className="text-right p-1">CTR</th>
                                        <th className="text-right p-1">CPC</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {details.placements.map((p, i) => (
                                        <tr key={i} className={`border-b ${getRowBgColor(p.acos)}`}>
                                          <td className="p-1">{p.placement}</td>
                                          <td className="text-right p-1">${p.spend.toFixed(2)}</td>
                                          <td className="text-right p-1">${p.sales.toFixed(2)}</td>
                                          <td className="text-right p-1">{p.orders}</td>
                                          <td className="text-right p-1">{p.clicks}</td>
                                          <td className={`text-right p-1 ${getAcosColor(p.acos)}`}>{p.acos > 0 ? `${p.acos.toFixed(2)}%` : '-'}</td>
                                          <td className="text-right p-1">{p.roas > 0 ? `${p.roas.toFixed(2)}x` : '-'}</td>
                                          <td className="text-right p-1">{p.cvr.toFixed(2)}%</td>
                                          <td className="text-right p-1">{p.ctr.toFixed(2)}%</td>
                                          <td className="text-right p-1">${p.cpc.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Rows per page:</label>
                <select 
                  value={campaignRowsPerPage} 
                  onChange={(e) => {
                    setCampaignRowsPerPage(Number(e.target.value));
                    setCampaignCurrentPage(1);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Page {campaignCurrentPage} of {Math.ceil(sortData(analysis.campaigns, campaignSort).length / campaignRowsPerPage)}
                </span>
                <button
                  onClick={() => setCampaignCurrentPage(Math.max(1, campaignCurrentPage - 1))}
                  disabled={campaignCurrentPage === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCampaignCurrentPage(Math.min(Math.ceil(sortData(analysis.campaigns, campaignSort).length / campaignRowsPerPage), campaignCurrentPage + 1))}
                  disabled={campaignCurrentPage >= Math.ceil(sortData(analysis.campaigns, campaignSort).length / campaignRowsPerPage)}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'keywords' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Search Keywords</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Min Clicks</label>
                  <input
                    type="number"
                    value={minClicks}
                    onChange={(e) => setMinClicks(parseInt(e.target.value) || 0)}
                    className="border rounded px-3 py-2 w-24"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Search Terms Performance ({filteredKeywords.length} results)</h2>
                <button
                  onClick={() => exportToExcel(sortData(filteredKeywords, keywordSort).map(k => ({
                    keyword: k.keyword,
                    spend: k.spend,
                    sales: k.sales,
                    orders: k.orders,
                    clicks: k.clicks,
                    acos: k.acos,
                    roas: k.roas,
                    cvr: k.cvr,
                    cpc: k.cpc
                  })), 'keywords')}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-8"></th>
                      <SortableHeader column="keyword" currentSort={keywordSort} setSortFunc={setKeywordSort}>Keyword</SortableHeader>
                      <SortableHeader column="spend" currentSort={keywordSort} setSortFunc={setKeywordSort}>Spend</SortableHeader>
                      <SortableHeader column="sales" currentSort={keywordSort} setSortFunc={setKeywordSort}>Sales</SortableHeader>
                      <SortableHeader column="orders" currentSort={keywordSort} setSortFunc={setKeywordSort}>Orders</SortableHeader>
                      <SortableHeader column="clicks" currentSort={keywordSort} setSortFunc={setKeywordSort}>Clicks</SortableHeader>
                      <SortableHeader column="acos" currentSort={keywordSort} setSortFunc={setKeywordSort}>ACoS</SortableHeader>
                      <SortableHeader column="roas" currentSort={keywordSort} setSortFunc={setKeywordSort}>ROAS</SortableHeader>
                      <SortableHeader column="cvr" currentSort={keywordSort} setSortFunc={setKeywordSort}>CVR</SortableHeader>
                      <SortableHeader column="cpc" currentSort={keywordSort} setSortFunc={setKeywordSort}>CPC</SortableHeader>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(filteredKeywords, keywordSort)
                      .slice((keywordCurrentPage - 1) * keywordRowsPerPage, keywordCurrentPage * keywordRowsPerPage)
                      .map((kw, idx) => {
                      const shouldNegate = kw.clicks >= 5 && kw.orders === 0;
                      const shouldScale = kw.acos > 0 && kw.acos <= targetAcos * 0.8 && kw.orders >= 3;
                      const isExpanded = expandedKeywords.has(kw.keyword);
                      
                      return (
                        <React.Fragment key={idx}>
                          <tr className={`border-b hover:bg-gray-50 ${getRowBgColor(kw.acos)}`}>
                            <td className="p-2">
                              <button onClick={() => toggleKeyword(kw.keyword)} className="text-gray-600 hover:text-gray-900">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="p-2 font-medium max-w-xs truncate">{kw.keyword}</td>
                            <td className="text-right p-2">${kw.spend.toFixed(2)}</td>
                            <td className="text-right p-2">${kw.sales.toFixed(2)}</td>
                            <td className="text-right p-2">{kw.orders}</td>
                            <td className="text-right p-2">{kw.clicks}</td>
                            <td className={`text-right p-2 ${getAcosColor(kw.acos)}`}>
                              {kw.acos > 0 ? `${kw.acos.toFixed(2)}%` : '-'}
                            </td>
                            <td className="text-right p-2">{kw.roas > 0 ? `${kw.roas.toFixed(2)}x` : '-'}</td>
                            <td className="text-right p-2">{kw.cvr.toFixed(2)}%</td>
                            <td className="text-right p-2">${kw.cpc.toFixed(2)}</td>
                            <td className="text-center p-2">
                              {shouldNegate && <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">NEGATE</span>}
                              {shouldScale && <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">SCALE</span>}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="11" className="p-4 bg-gray-50">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-bold mb-2">Campaigns Using This Keyword</h4>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left p-1">Campaign</th>
                                          <th className="text-right p-1">Spend</th>
                                          <th className="text-right p-1">Sales</th>
                                          <th className="text-right p-1">Orders</th>
                                          <th className="text-right p-1">ACoS</th>
                                          <th className="text-right p-1">ROAS</th>
                                          <th className="text-right p-1">CVR</th>
                                          <th className="text-right p-1">CPC</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {kw.campaignList.map((camp, i) => (
                                          <React.Fragment key={i}>
                                            <tr className={`border-b ${getRowBgColor(camp.acos)}`}>
                                              <td className="p-1 font-medium">{camp.name}</td>
                                              <td className="text-right p-1">${camp.spend.toFixed(2)}</td>
                                              <td className="text-right p-1">${camp.sales.toFixed(2)}</td>
                                              <td className="text-right p-1">{camp.orders}</td>
                                              <td className={`text-right p-1 ${getAcosColor(camp.acos)}`}>{camp.acos > 0 ? `${camp.acos.toFixed(2)}%` : '-'}</td>
                                              <td className="text-right p-1">{camp.roas > 0 ? `${camp.roas.toFixed(2)}x` : '-'}</td>
                                              <td className="text-right p-1">{camp.cvr.toFixed(2)}%</td>
                                              <td className="text-right p-1">${camp.cpc.toFixed(2)}</td>
                                            </tr>
                                            {camp.placementList && camp.placementList.length > 0 && (
                                              <tr>
                                                <td colSpan="8" className="p-2 pl-8 bg-gray-100">
                                                  <div className="text-xs">
                                                    <span className="font-semibold">Placements: </span>
                                                    {camp.placementList.map((p, pi) => (
                                                      <span key={pi} className="mr-3">
                                                        {p.name}: ${p.spend.toFixed(2)} 
                                                        <span className={getAcosColor(p.acos)}> ({p.acos > 0 ? `${p.acos.toFixed(2)}%` : '-'})</span>
                                                      </span>
                                                    ))}
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Rows per page:</label>
                  <select 
                    value={keywordRowsPerPage} 
                    onChange={(e) => {
                      setKeywordRowsPerPage(Number(e.target.value));
                      setKeywordCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {keywordCurrentPage} of {Math.ceil(sortData(filteredKeywords, keywordSort).length / keywordRowsPerPage)}
                  </span>
                  <button
                    onClick={() => setKeywordCurrentPage(Math.max(1, keywordCurrentPage - 1))}
                    disabled={keywordCurrentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setKeywordCurrentPage(Math.min(Math.ceil(sortData(filteredKeywords, keywordSort).length / keywordRowsPerPage), keywordCurrentPage + 1))}
                    disabled={keywordCurrentPage >= Math.ceil(sortData(filteredKeywords, keywordSort).length / keywordRowsPerPage)}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wasted-spend' && (
          <div className="space-y-6">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-red-900 mb-2">Wasted Spend - Negate Now</h3>
              <p className="text-3xl font-bold text-red-600 mb-2">${analysis.wastedSpend.totalWasted.toFixed(2)}</p>
              <p className="text-gray-700">{analysis.wastedSpend.keywords.length} keywords with 5+ clicks, $0 sales</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-red-600">⚠️ Negate These Keywords (5+ clicks, $0 sales)</h2>
                <button
                  onClick={() => exportToExcel(analysis.wastedSpend.keywords, 'wasted-spend')}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortableHeader column="keyword" currentSort={wastedSort} setSortFunc={setWastedSort}>Keyword</SortableHeader>
                      <SortableHeader column="spend" currentSort={wastedSort} setSortFunc={setWastedSort}>Spend</SortableHeader>
                      <SortableHeader column="clicks" currentSort={wastedSort} setSortFunc={setWastedSort}>Clicks</SortableHeader>
                      <th className="text-right p-2">Match Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(analysis.wastedSpend.keywords, wastedSort)
                      .slice((wastedCurrentPage - 1) * wastedRowsPerPage, wastedCurrentPage * wastedRowsPerPage)
                      .map((kw, idx) => (
                      <tr key={idx} className="border-b bg-red-50">
                        <td className="p-2 font-medium">{kw.keyword}</td>
                        <td className="text-right p-2 text-red-600 font-bold">${kw.spend.toFixed(2)}</td>
                        <td className="text-right p-2">{kw.clicks}</td>
                        <td className="text-right p-2">{kw.matchType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Rows per page:</label>
                  <select 
                    value={wastedRowsPerPage} 
                    onChange={(e) => {
                      setWastedRowsPerPage(Number(e.target.value));
                      setWastedCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {wastedCurrentPage} of {Math.ceil(sortData(analysis.wastedSpend.keywords, wastedSort).length / wastedRowsPerPage)}
                  </span>
                  <button
                    onClick={() => setWastedCurrentPage(Math.max(1, wastedCurrentPage - 1))}
                    disabled={wastedCurrentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setWastedCurrentPage(Math.min(Math.ceil(sortData(analysis.wastedSpend.keywords, wastedSort).length / wastedRowsPerPage), wastedCurrentPage + 1))}
                    disabled={wastedCurrentPage >= Math.ceil(sortData(analysis.wastedSpend.keywords, wastedSort).length / wastedRowsPerPage)}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inefficient-spend' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-yellow-900 mb-2">Inefficient Spend</h3>
              <p className="text-3xl font-bold text-yellow-600 mb-2">${analysis.inefficientSpend.totalInefficient.toFixed(2)}</p>
              <p className="text-gray-700">{analysis.inefficientSpend.items.length} items over {(targetAcos * 1.3).toFixed(1)}% ACoS (30% above your {targetAcos}% target)</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-yellow-600">⚠️ Inefficient Campaigns & Keywords</h2>
                <button
                  onClick={() => exportToExcel(analysis.inefficientSpend.items, 'inefficient-spend')}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortableHeader column="type" currentSort={inefficientSort} setSortFunc={setInefficientSort}>Type</SortableHeader>
                      <SortableHeader column="name" currentSort={inefficientSort} setSortFunc={setInefficientSort}>Name</SortableHeader>
                      <SortableHeader column="spend" currentSort={inefficientSort} setSortFunc={setInefficientSort}>Spend</SortableHeader>
                      <SortableHeader column="sales" currentSort={inefficientSort} setSortFunc={setInefficientSort}>Sales</SortableHeader>
                      <SortableHeader column="orders" currentSort={inefficientSort} setSortFunc={setInefficientSort}>Orders</SortableHeader>
                      <SortableHeader column="acos" currentSort={inefficientSort} setSortFunc={setInefficientSort}>ACoS</SortableHeader>
                      <SortableHeader column="roas" currentSort={inefficientSort} setSortFunc={setInefficientSort}>ROAS</SortableHeader>
                      <SortableHeader column="cpc" currentSort={inefficientSort} setSortFunc={setInefficientSort}>CPC</SortableHeader>
                      <th className="text-left p-2">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(analysis.inefficientSpend.items, inefficientSort)
                      .slice((inefficientCurrentPage - 1) * inefficientRowsPerPage, inefficientCurrentPage * inefficientRowsPerPage)
                      .map((item, idx) => (
                      <tr key={idx} className={`border-b ${getRowBgColor(item.acos)}`}>
                        <td className="p-2">
                          <span className={`text-xs px-2 py-1 rounded ${item.type === 'campaign' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-2 font-medium max-w-xs truncate">{item.name}</td>
                        <td className="text-right p-2">${item.spend.toFixed(2)}</td>
                        <td className="text-right p-2">${item.sales.toFixed(2)}</td>
                        <td className="text-right p-2">{item.orders}</td>
                        <td className={`text-right p-2 ${getAcosColor(item.acos)}`}>{item.acos.toFixed(2)}%</td>
                        <td className="text-right p-2">{item.roas.toFixed(2)}x</td>
                        <td className="text-right p-2">${item.cpc.toFixed(2)}</td>
                        <td className="text-left p-2 text-xs">
                          Lower bid to ${(item.cpc * 0.7).toFixed(2)} CPC (-30%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Rows per page:</label>
                  <select 
                    value={inefficientRowsPerPage} 
                    onChange={(e) => {
                      setInefficientRowsPerPage(Number(e.target.value));
                      setInefficientCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {inefficientCurrentPage} of {Math.ceil(sortData(analysis.inefficientSpend.items, inefficientSort).length / inefficientRowsPerPage)}
                  </span>
                  <button
                    onClick={() => setInefficientCurrentPage(Math.max(1, inefficientCurrentPage - 1))}
                    disabled={inefficientCurrentPage === 1}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setInefficientCurrentPage(Math.min(Math.ceil(sortData(analysis.inefficientSpend.items, inefficientSort).length / inefficientRowsPerPage), inefficientCurrentPage + 1))}
                    disabled={inefficientCurrentPage >= Math.ceil(sortData(analysis.inefficientSpend.items, inefficientSort).length / inefficientRowsPerPage)}
                    className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">🎯 Optimization Recommendations</h2>
            <p className="text-gray-600">Based on your {targetAcos}% ACoS target</p>
            {analysis.recommendations.map((rec, idx) => (
              <RecommendationCard key={idx} recommendation={rec} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-xs font-medium text-gray-600 mb-1">{title}</h3>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function RecommendationCard({ recommendation }) {
  const bgColor = recommendation.type === 'success' ? 'bg-green-50 border-green-200' :
                   recommendation.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                   recommendation.type === 'danger' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200';
  
  const iconColor = recommendation.type === 'success' ? 'text-green-600' :
                     recommendation.type === 'warning' ? 'text-yellow-600' :
                     recommendation.type === 'danger' ? 'text-red-600' : 'text-blue-600';
  
  const Icon = recommendation.type === 'success' ? CheckCircle :
               recommendation.type === 'danger' ? XCircle : AlertTriangle;

  return (
    <div className={`${bgColor} border-2 rounded-xl p-6`}>
      <div className="flex items-start gap-4">
        <Icon className={`w-8 h-8 ${iconColor} flex-shrink-0`} />
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-gray-900">{recommendation.title}</h3>
            <span className={`px-3 py-1 rounded text-xs font-bold ${
              recommendation.priority === 'high' ? 'bg-red-600 text-white' :
              recommendation.priority === 'medium' ? 'bg-yellow-600 text-white' :
              'bg-blue-600 text-white'
            }`}>
              {recommendation.priority.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-700 mb-3">{recommendation.description}</p>
          {recommendation.action && (
            <div className="bg-white bg-opacity-60 rounded px-3 py-2 inline-block mb-3">
              <span className="font-bold">Action: </span>{recommendation.action}
            </div>
          )}
          {recommendation.details && recommendation.details.length > 0 && (
            <div className="mt-3 bg-white bg-opacity-60 rounded p-3">
              <div className="font-medium mb-2">Specific Actions:</div>
              <div className="text-sm text-gray-700 space-y-1 whitespace-pre-line">
                {recommendation.details.join('\n')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
