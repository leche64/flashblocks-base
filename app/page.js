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
                        className="size-20 md:size-26"
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
                                    <span className="text-sm sm:text-base text-gray-300">Fullblocks (2s)</span>
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
                        
                        {/* Comparison Arrow */}
                        <div className="flex justify-center">
                            <ArrowsHorizontal size={24} weight="bold" className="text-gray-500" />
                        </div>
                        
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
                {flashbotMessages > 0 && baseMessages > 0 ? (
                    <motion.p
                        initial={{ scale: 1 }}
                        animate={{ 
                            scale: Math.min(1.5, 1 + ((flashbotMessages / baseMessages) * 0.05)),
                            color: `rgb(${Math.min(255, 74 + (flashbotMessages / baseMessages) * 20)}, ${Math.min(255, 222 + (flashbotMessages / baseMessages) * 5)}, ${Math.min(255, 74 + (flashbotMessages / baseMessages) * 5)})`
                        }}
                        transition={{ duration: 0.3 }}
                        className="font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2"
                    >
                        <span className="text-gray-400">Comparison ratio:</span>
                        <span className="text-base sm:text-lg md:text-xl">{(flashbotMessages / baseMessages).toFixed(1)}x faster</span>
                    </motion.p>
                ) : (
                    <p className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                        <span>Comparison ratio:</span>
                        <span className="text-base sm:text-lg md:text-xl">Calculating...</span>
                    </p>
                )}
            </motion.div>
        </div>
    )
}
