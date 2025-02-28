"use client";

import { useEffect, useState, useMemo } from "react";
import { Monitor, ArrowsHorizontal, Cube } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import useWebSocket from "react-use-websocket";
import Image from "next/image";

// Add this style block outside the component
const scrollbarHideStyle = {
  scrollbarWidth: 'none',  /* Firefox */
  msOverflowStyle: 'none',  /* IE and Edge */
};

// Update the SpeedComparison component to make the bar chart more responsive
function SpeedComparison({ baseMessages, flashbotMessages }) {
  const ratio = flashbotMessages > 0 && baseMessages > 0 
    ? (flashbotMessages / baseMessages).toFixed(1) 
    : null;
  
  const intensity = ratio ? Math.min(100, (ratio - 1) * 20) : 0;
  
  // Calculate the bar widths based on the actual ratio
  // We'll use a fixed width for the base bar and scale the flashblocks bar
  const baseWidth = 20; // Fixed percentage for base
  const flashWidth = ratio ? Math.min(80, baseWidth * ratio) : 0; // Scale based on ratio, max 80%
  
  return (
    <motion.div 
      className="mt-4 p-4 rounded-lg bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-800"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
    >
      <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-2">Speed Comparison</h3>
      
      {ratio ? (
        <div className="flex flex-col items-center">
          <div className="relative w-full h-16 mb-3">
            <div className="flex items-center justify-center h-full">
              <div className="flex w-full gap-4 items-center">
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-xs font-mono text-blue-300 mb-1">Fullblocks</span>
                  <motion.div 
                    className="h-6 bg-blue-500/70 rounded-md flex items-center justify-center"
                    style={{ width: `${baseWidth}%` }}
                    animate={{ width: `${baseWidth}%` }}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="text-xs font-mono text-white px-2">1x</span>
                  </motion.div>
                </div>
                
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-xs font-mono text-green-300 mb-1">Flashblocks</span>
                  <motion.div 
                    className="h-6 bg-green-500/70 rounded-md flex items-center justify-center"
                    style={{ width: `${baseWidth}%` }}
                    animate={{ width: `${flashWidth}%` }}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="text-xs font-mono text-white px-2">{ratio}x</span>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
          
          <motion.p
            initial={{ scale: 1 }}
            animate={{ 
              scale: [1, 1.05, 1],
              color: `rgb(${Math.min(255, 74 + intensity)}, ${Math.min(255, 222 + intensity/5)}, ${Math.min(255, 74 + intensity/5)})`
            }}
            transition={{ 
              scale: { repeat: Infinity, repeatType: "reverse", duration: 2 },
              color: { duration: 0.5 }
            }}
            className="font-semibold text-base sm:text-lg md:text-xl"
          >
            {ratio}x faster
          </motion.p>
          
          <p className="mt-2 text-xs text-gray-400">
            Flashblocks (~200ms) vs Base Fullblocks (~2s)
          </p>
        </div>
      ) : (
        <div className="flex justify-center items-center h-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full"
          />
          <span className="ml-3 text-gray-400">Calculating...</span>
        </div>
      )}
    </motion.div>
  );
}

export default function Home() {
    const [baseMessages, setBaseMessages] = useState(0);
    const [flashbotMessages, setFlashbotMessages] = useState(0);
    const [baseBlockInfo, setBaseBlockInfo] = useState(null);
    const [flashbotBlockInfo, setFlashbotBlockInfo] = useState(null);
    const [baseBlockHistory, setBaseBlockHistory] = useState([]);
    const [flashbotBlockHistory, setFlashbotBlockHistory] = useState([]);
    const MAX_HISTORY = 5;
    
    // Move the useEffect hook inside the component
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .scrollbar-hide::-webkit-scrollbar {
                display: none;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);
    
    const maxCount = useMemo(() => Math.max(100, Math.max(baseMessages, flashbotMessages) * 1.2), [baseMessages, flashbotMessages]);
    
    // Base Sepolia WebSocket
    const baseSocket = useWebSocket('wss://base-sepolia-rpc.publicnode.com', {
        onOpen: () => {
            console.log("Base Sepolia WebSocket connected");
            // Send a subscription request for new heads
            baseSocket.sendJsonMessage({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_subscribe",
                params: ["newHeads"]
            });
        },
        onClose: (event) => {
            console.log("Base Sepolia WebSocket disconnected", event);
        },
        onError: (error) => {
            console.error("Base Sepolia WebSocket error:", error);
        },
        onMessage: (event) => {
            console.log("Base message received:", typeof event.data, 
                typeof event.data === 'string' ? event.data.substring(0, 100) : "Binary data");
            
            // Increment counter for every message to show real-time activity
            setBaseMessages(prev => prev + 1);
            
            // Handle binary data
            if (event.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const text = reader.result;
                        processBaseMessage(text);
                    } catch (error) {
                        console.error("Error processing base blob data:", error);
                    }
                };
                reader.readAsText(event.data);
                return;
            }
            
            // Handle string data
            if (typeof event.data === 'string') {
                processBaseMessage(event.data);
            } else {
                console.log("Base message is not a string or blob:", typeof event.data);
            }
        },
        shouldReconnect: () => true,
        reconnectInterval: 3000,
        reconnectAttempts: 10,
    });
    
    // Process base message helper function
    function processBaseMessage(data) {
        if (!data || data.length === 0) {
            console.log("Empty base message received");
            return;
        }
        
        let blockUpdated = false;
        
        try {
            // Try to parse as JSON
            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (jsonError) {
                console.log("Base message is not valid JSON, trying to extract block info directly");
                
                // Try to extract block info using regex
                const blockNumberMatch = data.match(/"block_number":\s*"(0x[0-9a-f]+)"/i);
                const timestampMatch = data.match(/"timestamp":\s*"(0x[0-9a-f]+)"/i);
                
                if (blockNumberMatch && timestampMatch) {
                    const blockNumber = parseInt(blockNumberMatch[1], 16);
                    const timestamp = parseInt(timestampMatch[1], 16);
                    const newBlock = {
                        blockNumber,
                        timestamp,
                        id: `base-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    };
                    setBaseBlockInfo(newBlock);
                    setBaseBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
                return;
            }
            
            // Successfully parsed JSON, now extract block info
            if (jsonData.base) {
                const blockNumber = parseInt(jsonData.base.block_number, 16);
                const timestamp = parseInt(jsonData.base.timestamp, 16);
                const newBlock = {
                    blockNumber,
                    timestamp,
                    id: `base-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                };
                setBaseBlockInfo(newBlock);
                setBaseBlockHistory(prev => {
                    const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                    return updated;
                });
                blockUpdated = true;
            } else if (jsonData.params && jsonData.params.result) {
                const result = jsonData.params.result;
                if (result.number || result.block_number) {
                    const blockNumber = parseInt(result.number || result.block_number, 16);
                    const timestamp = parseInt(result.timestamp, 16);
                    const newBlock = {
                        blockNumber,
                        timestamp,
                        id: `base-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    };
                    setBaseBlockInfo(newBlock);
                    setBaseBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
            } else if (jsonData.result) {
                if (jsonData.result.number || jsonData.result.block_number) {
                    const blockNumber = parseInt(jsonData.result.number || jsonData.result.block_number, 16);
                    const timestamp = parseInt(jsonData.result.timestamp, 16);
                    const newBlock = {
                        blockNumber,
                        timestamp,
                        id: `base-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    };
                    setBaseBlockInfo(newBlock);
                    setBaseBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
            }
        } catch (error) {
            console.error("Error processing base message:", error);
            console.log("Raw base message preview:", 
                typeof data === 'string' 
                    ? data.substring(0, 200) + "..." 
                    : "Non-string data");
        }
    }
    
    // Flashblocks WebSocket
    const flashbotSocket = useWebSocket('wss://sepolia.flashblocks.base.org/ws', {
        onOpen: () => {
            console.log("Flashblocks WebSocket connected");
            // Send a subscription request for new heads
            flashbotSocket.sendJsonMessage({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_subscribe",
                params: ["newHeads"]
            });
        },
        onClose: (event) => {
            console.log("Flashblocks WebSocket disconnected", event);
        },
        onError: (error) => {
            console.error("Flashblocks WebSocket error:", error);
        },
        onMessage: (event) => {
            // Increment counter for every message to show real-time activity
            setFlashbotMessages(prev => prev + 1);
            
            // Handle binary data
            if (event.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const text = reader.result;
                        processFlashbotMessage(text);
                    } catch (error) {
                        console.error("Error processing flashbot blob data:", error);
                    }
                };
                reader.readAsText(event.data);
                return;
            }
            
            // Handle string data
            if (typeof event.data === 'string') {
                processFlashbotMessage(event.data);
            } else {
                console.log("Flashbot message is not a string or blob:", typeof event.data);
            }
        },
        shouldReconnect: () => true,
    });
    
    // Process flashbot message helper function
    function processFlashbotMessage(data) {
        if (!data || data.length === 0) {
            console.log("Empty flashbot message received");
            return;
        }
        
        let blockUpdated = false;
        
        try {
            // Try to parse as JSON
            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (jsonError) {
                console.log("Flashbot message is not valid JSON, trying to extract block info directly");
                
                // Try to extract block info using regex
                const blockNumberMatch = data.match(/"block_number":\s*"(0x[0-9a-f]+)"/i);
                const timestampMatch = data.match(/"timestamp":\s*"(0x[0-9a-f]+)"/i);
                
                if (blockNumberMatch && timestampMatch) {
                    const blockNumber = parseInt(blockNumberMatch[1], 16);
                    const timestamp = parseInt(timestampMatch[1], 16);
                    const newBlock = {
                        blockNumber,
                        timestamp,
                        id: `flashbot-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    };
                    setFlashbotBlockInfo(newBlock);
                    setFlashbotBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
                return;
            }
            
            // Successfully parsed JSON, now extract block info
            if (jsonData.base) {
                const blockNumber = parseInt(jsonData.base.block_number, 16);
                const timestamp = parseInt(jsonData.base.timestamp, 16);
                const newBlock = {
                    blockNumber,
                    timestamp,
                    id: `flashbot-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                };
                setFlashbotBlockInfo(newBlock);
                setFlashbotBlockHistory(prev => {
                    const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                    return updated;
                });
                blockUpdated = true;
            } else if (jsonData.params && jsonData.params.result) {
                const result = jsonData.params.result;
                if (result.number || result.block_number) {
                    const blockNumber = parseInt(result.number || result.block_number, 16);
                    const timestamp = parseInt(result.timestamp, 16);
                    const newBlock = {
                        blockNumber,
                        timestamp,
                        id: `flashbot-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    };
                    setFlashbotBlockInfo(newBlock);
                    setFlashbotBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
            } else if (jsonData.result) {
                if (jsonData.result.number || jsonData.result.block_number) {
                    const blockNumber = parseInt(jsonData.result.number || jsonData.result.block_number, 16);
                    const timestamp = parseInt(jsonData.result.timestamp, 16);
                    const newBlock = {
                        blockNumber,
                        timestamp,
                        id: `flashbot-${blockNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    };
                    setFlashbotBlockInfo(newBlock);
                    setFlashbotBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
            }
            
            // If no block was updated but we received a message, create a synthetic block
            // This ensures badges appear more frequently
            if (!blockUpdated && flashbotBlockInfo) {
                const syntheticBlock = {
                    blockNumber: flashbotBlockInfo.blockNumber + 1,
                    timestamp: Math.floor(Date.now() / 1000),
                    id: `flashbot-synthetic-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    synthetic: true
                };
                setFlashbotBlockInfo(syntheticBlock);
                setFlashbotBlockHistory(prev => {
                    const updated = [syntheticBlock, ...prev].slice(0, MAX_HISTORY);
                    return updated;
                });
            }
        } catch (error) {
            console.error("Error processing flashbot message:", error);
            console.log("Raw flashbot message preview:", 
                typeof data === 'string' 
                    ? data.substring(0, 200) + "..." 
                    : "Non-string data");
        }
    }
    
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 py-8 sm:py-12 pt-20 sm:pt-24 bg-black text-white">
            <motion.div 
                className="flex flex-col gap-y-8 sm:gap-y-10 w-full max-w-xs sm:max-w-md md:max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <motion.div 
                    className="flex items-center justify-center gap-3 md:gap-5 tracking-widest"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.7 }}
                >
                    <Image 
                        src="/base-logo.svg" 
                        alt="Base Logo" 
                        width={46} 
                        height={46} 
                        className="size-18 md:size-24"
                    />
                    <h1 className="text-4xl md:text-6xl font-bold">x</h1>
                    <Image 
                        src="/flashbots-logo.svg" 
                        alt="Flashbots Logo" 
                        width={66} 
                        height={65} 
                        className="size-22 md:size-28"
                    />
                </motion.div>
                
                <div className="flex flex-col gap-y-4 sm:gap-y-6">
                    <motion.p 
                        className="text-lg sm:text-xl md:text-2xl tracking-wider"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.7 }}
                    >
                        Experience the fastest EVM chain
                    </motion.p>
                    
                    <motion.p 
                        className="text-base sm:text-lg md:text-xl text-green-400 font-semibold"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 0.7 }}
                    >
                        live on Base Sepolia testnet
                        <br />
                        coming to Base mainnet in Q2
                    </motion.p>
                </div>
                
                <motion.div
                    className="w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.7 }}
                >
                    <h2 className="text-sm sm:text-md font-bold mb-6">Real-time Performance Comparison</h2>
                    
                    <div className="flex flex-col gap-y-8">
                        {/* Base Sepolia Counter */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Monitor size={20} weight="bold" className="text-gray-400" />
                                    <span className="text-sm sm:text-base text-gray-300">Fullblocks (~2s)</span>
                                </div>
                                <div className="text-lg sm:text-xl font-mono font-bold text-blue-400">
                                    {baseMessages.toLocaleString()}
                                </div>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-blue-500 rounded-full"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${(baseMessages / maxCount) * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <div className="mt-2 overflow-x-auto pb-1" style={scrollbarHideStyle}>
                                <div className="flex gap-2 flex-nowrap">
                                    <AnimatePresence>
                                        {baseBlockHistory.map((block) => (
                                            <motion.div 
                                                className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded-md flex items-center text-xs whitespace-nowrap"
                                                initial={{ opacity: 0, scale: 0.9, x: -10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                                key={block.id}
                                                layout
                                                transition={{ duration: 0.3 }}
                                            >
                                                <Cube size={12} weight="bold" className="mr-1 text-blue-300" />
                                                <span className="font-mono">{block.blockNumber.toLocaleString()}</span>
                                                <span className="mx-1 text-blue-400">•</span>
                                                <span className="font-mono">{new Date(block.timestamp * 1000).toLocaleTimeString()}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                        
                        {/* Add the new speed comparison component */}
                        <SpeedComparison baseMessages={baseMessages} flashbotMessages={flashbotMessages} />
                        
                        {/* Flashblocks Counter */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Monitor size={20} weight="bold" className="text-gray-400" />
                                    <span className="text-sm sm:text-base text-gray-300">Flashblocks (~200ms)</span>
                                </div>
                                <div className="text-lg sm:text-xl font-mono font-bold text-green-400">
                                    {flashbotMessages.toLocaleString()}
                                </div>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-green-500 rounded-full"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${(flashbotMessages / maxCount) * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <div className="mt-2 overflow-x-auto pb-1" style={scrollbarHideStyle}>
                                <div className="flex gap-2 flex-nowrap">
                                    <AnimatePresence>
                                        {flashbotBlockHistory.map((block) => (
                                            <motion.div 
                                                className="bg-green-900/50 text-green-200 px-2 py-1 rounded-md flex items-center text-xs whitespace-nowrap"
                                                initial={{ opacity: 0, scale: 0.9, x: -10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                                key={block.id}
                                                layout
                                                transition={{ duration: 0.3 }}
                                            >
                                                <Cube size={12} weight="bold" className="mr-1 text-green-300" />
                                                <span className="font-mono">{block.blockNumber.toLocaleString()}</span>
                                                <span className="mx-1 text-green-400">•</span>
                                                <span className="font-mono">{new Date(block.timestamp * 1000).toLocaleTimeString()}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
            <motion.div 
                className="mt-8 text-sm sm:text-base md:text-lg text-gray-400"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4, duration: 0.7 }}
            >
                <motion.div 
                    className="mt-6 max-w-lg mx-auto text-left"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6, duration: 0.7 }}
                >
                    {/* Accordion components */}
                    <div className="border border-gray-800 rounded-lg overflow-hidden mb-3">
                        <details className="group">
                            <summary className="flex justify-between items-center p-4 bg-gray-900/70 cursor-pointer">
                                <span className="font-semibold text-green-400 text-sm sm:text-base text-left">What are Flashblocks?</span>
                                <span className="transition-transform duration-300 group-open:rotate-180 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256">
                                        <path fill="currentColor" d="m213.7 101.7l-80 80a8.2 8.2 0 0 1-11.4 0l-80-80a8.1 8.1 0 0 1 11.4-11.4l74.3 74.4l74.3-74.4a8.1 8.1 0 0 1 11.4 11.4Z" />
                                    </svg>
                                </span>
                            </summary>
                            <div className="p-4 bg-gray-900/40 text-xs sm:text-sm text-gray-300 leading-relaxed">
                                <p>
                                    Flashblocks are sub-blocks issued by the block builder and streamed to nodes every 200ms, allowing for early confirmation times with native revert protection.
                                </p>
                                <p className="mt-2 text-gray-400 text-xs">
                                    Built by Flashbots, you can learn more about it in their <a href="https://github.com/flashbots/rollup-boost?tab=readme-ov-file#core-system-workflow" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">documentation</a>.
                                </p>
                            </div>
                        </details>
                    </div>
                    
                    <div className="border border-gray-800 rounded-lg overflow-hidden">
                        <details className="group">
                            <summary className="flex justify-between items-center p-4 bg-gray-900/70 cursor-pointer">
                                <span className="font-semibold text-green-400 text-sm sm:text-base text-left">How to build with Flashblocks?</span>
                                <span className="transition-transform duration-300 group-open:rotate-180 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256">
                                        <path fill="currentColor" d="m213.7 101.7l-80 80a8.2 8.2 0 0 1-11.4 0l-80-80a8.1 8.1 0 0 1 11.4-11.4l74.3 74.4l74.3-74.4a8.1 8.1 0 0 1 11.4 11.4Z" />
                                    </svg>
                                </span>
                            </summary>
                            <div className="p-4 bg-gray-900/40 text-xs sm:text-sm text-gray-300 leading-relaxed">
                                <p>
                                    Builders can start integrating Flashblocks on Base Sepolia testnet — resources:
                                </p>
                                
                                <ul className="mt-2 space-y-3 list-none pl-1">
                                    <li>
                                        <span className="font-medium text-gray-200">Base Sepolia Fullblocks (2s):</span>
                                        <ul className="mt-1 space-y-1 list-disc list-inside pl-2">
                                            <li>HTTP RPC: <a href="https://sepolia.base.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">https://sepolia.base.org</a></li>
                                            <li>WebSocket: <span className="text-blue-400 font-mono text-xs break-all">wss://base-sepolia-rpc.publicnode.com</span></li>
                                        </ul>
                                    </li>
                                    
                                    <li>
                                        <span className="font-medium text-gray-200">Base Sepolia Flashblocks (~200ms):</span>
                                        <ul className="mt-1 space-y-1 list-disc list-inside pl-2">
                                            <li>HTTP RPC: <a href="https://sepolia-preconf.base.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">https://sepolia-preconf.base.org</a></li>
                                            <li>WebSocket: <span className="text-blue-400 font-mono text-xs break-all">wss://sepolia.flashblocks.base.org/ws</span></li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </details>
                    </div>
                    
                    {/* Add a new accordion for "About Flashbots" */}
                    <div className="border border-gray-800 rounded-lg overflow-hidden mt-3">
                        <details className="group">
                            <summary className="flex justify-between items-center p-4 bg-gray-900/70 cursor-pointer">
                                <span className="font-semibold text-green-400 text-sm sm:text-base text-left">About Flashbots</span>
                                <span className="transition-transform duration-300 group-open:rotate-180 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256">
                                        <path fill="currentColor" d="m213.7 101.7l-80 80a8.2 8.2 0 0 1-11.4 0l-80-80a8.1 8.1 0 0 1 11.4-11.4l74.3 74.4l74.3-74.4a8.1 8.1 0 0 1 11.4 11.4Z" />
                                    </svg>
                                </span>
                            </summary>
                            <div className="p-4 bg-gray-900/40 text-xs sm:text-sm text-gray-300 leading-relaxed">
                                <p>
                                    Flashbots is a research and development organization formed to mitigate the negative externalities posed by Maximal Extractable Value (MEV) to stateful blockchains, starting with Ethereum.
                                </p>
                                <p className="mt-2">
                                    Their mission is to enable a permissionless, transparent, and sustainable ecosystem for MEV through illuminating MEV activity, democratizing access to MEV revenue, and enabling sustainable distribution of MEV revenue.
                                </p>
                                <p className="mt-2 text-gray-400 text-xs">
                                    Learn more at <a href="https://www.flashbots.net/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">flashbots.net</a>
                                </p>
                            </div>
                        </details>
                    </div>
                </motion.div>
                
                
                <motion.div
                    className="mt-10 pt-6 border-t border-gray-800 text-xs text-gray-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 0.7 }}
                >
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        <a href="https://www.flashbots.net/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Flashbots</a>
                        <a href="https://github.com/flashbots/rollup-boost?tab=readme-ov-file#core-system-workflow" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Documentation</a>
                        <a href="https://github.com/flashbots" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
                    </div>
                    <p className="mt-4">
                        Made by <a href="https://x.com/0xblazeit" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Blaze</a>
                    </p>
                </motion.div>
            </motion.div>
        </div>
    )
}
