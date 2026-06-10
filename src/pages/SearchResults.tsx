import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

const toScheduleTrainType = (category: string) => {
    if (category === 'HIGH_QUALITY') return 'CLC';
    return category;
};

const SearchResults: React.FC = () => {
    const [searchParams] = useSearchParams();
    const next = new URLSearchParams(searchParams);
    const trainCategory = next.get('trainCategory');

    if (trainCategory && !next.has('trainType')) {
        next.set('trainType', toScheduleTrainType(trainCategory));
    }

    next.delete('trainCategory');

    const queryString = next.toString();

    return <Navigate replace to={`/search${queryString ? `?${queryString}` : ''}`} />;
};

export default SearchResults;
