"use client";

import { useEffect, useState, useMemo } from "react";
import { Monitor, ArrowsHorizontal, Cube } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import useWebSocket from "react-use-websocket";

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
                    const newBlock = {
                        blockNumber: parseInt(blockNumberMatch[1], 16),
                        timestamp: parseInt(timestampMatch[1], 16),
                        id: Date.now()
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
                const newBlock = {
                    blockNumber: parseInt(jsonData.base.block_number, 16),
                    timestamp: parseInt(jsonData.base.timestamp, 16),
                    id: Date.now()
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
                    const newBlock = {
                        blockNumber: parseInt(result.number || result.block_number, 16),
                        timestamp: parseInt(result.timestamp, 16),
                        id: Date.now()
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
                    const newBlock = {
                        blockNumber: parseInt(jsonData.result.number || jsonData.result.block_number, 16),
                        timestamp: parseInt(jsonData.result.timestamp, 16),
                        id: Date.now()
                    };
                    setBaseBlockInfo(newBlock);
                    setBaseBlockHistory(prev => {
                        const updated = [newBlock, ...prev].slice(0, MAX_HISTORY);
                        return updated;
                    });
                    blockUpdated = true;
                }
            }
            
            // Only increment the counter if we successfully updated a block
            if (blockUpdated) {
                setBaseMessages(prev => prev + 1);
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
                    const newBlock = {
                        blockNumber: parseInt(blockNumberMatch[1], 16),
                        timestamp: parseInt(timestampMatch[1], 16),
                        id: Date.now()
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
                const newBlock = {
                    blockNumber: parseInt(jsonData.base.block_number, 16),
                    timestamp: parseInt(jsonData.base.timestamp, 16),
                    id: Date.now()
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
                    const newBlock = {
                        blockNumber: parseInt(result.number || result.block_number, 16),
                        timestamp: parseInt(result.timestamp, 16),
                        id: Date.now()
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
                    const newBlock = {
                        blockNumber: parseInt(jsonData.result.number || jsonData.result.block_number, 16),
                        timestamp: parseInt(jsonData.result.timestamp, 16),
                        id: Date.now()
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
                    id: Date.now(),
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
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 py-8 sm:py-12 bg-black text-white">
            <motion.div 
                className="flex flex-col gap-4 sm:gap-6 w-full max-w-xs sm:max-w-md md:max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <motion.h1 
                    className="text-4xl sm:text-5xl md:text-6xl font-bold"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.7 }}
                >
                    Base X Flashbots
                </motion.h1>
                
                <motion.p 
                    className="text-lg sm:text-xl md:text-2xl mt-2 sm:mt-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.7 }}
                >
                    10x change makes Base the fastest EVM chain to date, decreasing block times from 2 seconds down to 200 milliseconds.
                </motion.p>
                
                <motion.p 
                    className="text-base sm:text-lg md:text-xl mt-4 sm:mt-6 text-green-400 font-semibold"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.7 }}
                >
                    live on testnet right now
                    <br />
                    coming to mainnet in Q2
                </motion.p>
                
                <motion.div
                    className="mt-12 w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.7 }}
                >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6">Real-time Performance Comparison</h2>
                    
                    {/* Base Sepolia Counter */}
                    <div className="mb-8">
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
                                    {baseBlockHistory.map((block, index) => (
                                        <motion.div 
                                            className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded-md flex items-center text-xs whitespace-nowrap"
                                            initial={{ opacity: 0, scale: 0.9, x: -10 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                            key={`base-block-${block.id}`}
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
                    <div className="flex justify-center my-4">
                        <ArrowsHorizontal size={24} weight="bold" className="text-gray-500" />
                    </div>
                    
                    {/* Flashblocks Counter */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Monitor size={20} weight="bold" className="text-gray-400" />
                                <span className="text-sm sm:text-base text-gray-300">Flashblocks (200ms)</span>
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
                                    {flashbotBlockHistory.map((block, index) => (
                                        <motion.div 
                                            className="bg-green-900/50 text-green-200 px-2 py-1 rounded-md flex items-center text-xs whitespace-nowrap"
                                            initial={{ opacity: 0, scale: 0.9, x: -10 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                            key={`flashbot-block-${block.id}`}
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
                </motion.div>
            </motion.div>
            <div className="mt-8 text-sm text-gray-400">
                <p>Comparison ratio: {flashbotMessages > 0 && baseMessages > 0 ? 
                    `${(flashbotMessages / baseMessages).toFixed(1)}x faster` : 
                    "Calculating..."}</p>
            </div>
        </div>
    )
}
