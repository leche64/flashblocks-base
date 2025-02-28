"use client";

import { useEffect, useState, useMemo } from "react";
import { Monitor, ArrowsHorizontal } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import useWebSocket from "react-use-websocket";

export default function Home() {
    const [baseMessages, setBaseMessages] = useState(0);
    const [flashbotMessages, setFlashbotMessages] = useState(0);
    
    const maxCount = useMemo(() => Math.max(100, Math.max(baseMessages, flashbotMessages) * 1.2), [baseMessages, flashbotMessages]);
    
    // Base Sepolia WebSocket
    const baseSocket = useWebSocket('wss://base-sepolia-rpc.publicnode.com', {
        onMessage: () => {
            setBaseMessages(prev => prev + 1);
        },
        shouldReconnect: () => true,
    });
    
    // Flashblocks WebSocket
    const flashbotSocket = useWebSocket('wss://sepolia.flashblocks.base.org/ws', {
        onMessage: () => {
            setFlashbotMessages(prev => prev + 1);
        },
        shouldReconnect: () => true,
    });
    
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
                    10x change makes Base the fastest EVM chain to date, bringing effective block times from 2 seconds down to 200 milliseconds.
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
                    </div>
                </motion.div>
            </motion.div>
        </div>
    )
}
