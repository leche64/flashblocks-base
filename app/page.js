"use client";

import { useEffect, useState, useMemo } from "react";
import { Monitor, ArrowsHorizontal } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import useWebSocket from "react-use-websocket";

export default function Home() {
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
            </motion.div>
        </div>
    )
}
