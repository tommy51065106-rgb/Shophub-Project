import React from 'react';
import { Link } from 'react-router-dom';
import './Breadcrumb.css';

const Breadcrumb = ({ items }) => {
    return (
        <nav className="breadcrumb-nav">
            <ul>
                {items.map((item, index) => (
                    <li key={index}>
                        {index > 0 && <span className="breadcrumb-separator">></span>}
                        {item.link ? (
                            <Link to={item.link}>{item.label}</Link>
                        ) : (
                            <span className="breadcrumb-current">{item.label}</span>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Breadcrumb;
