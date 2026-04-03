import React, { useState, useEffect } from 'react';
import { getSwapRate, getGasEstimate, validateQuote } from './api';
import { formatCurrency } from './utils';

const SwapSection = () => {
    const [swapRate, setSwapRate] = useState(0);
    const [gasEstimate, setGasEstimate] = useState(0);
    const [quoteValid, setQuoteValid] = useState(true);
    const [error, setError] = useState('');
    const [usdValue, setUsdValue] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const rate = await getSwapRate();
                setSwapRate(rate);
                const gas = await getGasEstimate();
                setGasEstimate(gas);
                validateQuote(rate); // Update this as per your API's validation method
                setQuoteValid(true);
            } catch (err) {
                setError('Error fetching data');
                setQuoteValid(false);
            }
        };

        fetchData();
    }, []);

    const handleAmountChange = (amount) => {
        const calculatedValue = amount * swapRate;
        setUsdValue(formatCurrency(calculatedValue));
    };

    return (
        <div>
            <h2>Swap Section</h2>
            {error && <p className="error">{error}</p>}
            <div>
                <label>Amount:</label>
                <input type="number" onChange={(e) => handleAmountChange(e.target.value)} />
            </div>
            <div>
                <p>Swap Rate: {swapRate}</p>
                <p>Gas Estimate: {gasEstimate}</p>
                <p>USD Value: {usdValue}</p>
                <p>{!quoteValid && 'Quote is invalid.'}</p>
            </div>
        </div>
    );
};

export default SwapSection;