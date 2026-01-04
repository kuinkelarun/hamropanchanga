// bsCalendarData.js
// Mapping of Bikram Sambat year -> { startAdDate: Date, daysInMonths: [..] }
// Note: JS Date months are 0-based (0=Jan, 3=Apr). Keep comments with real AD dates.
const bsCalendarData = {
    2000: { startAdDate: new Date(1943, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 14, 1943
    2001: { startAdDate: new Date(1944, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1944
    2002: { startAdDate: new Date(1945, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1945
    2003: { startAdDate: new Date(1946, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1946
    2004: { startAdDate: new Date(1947, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 14, 1947
    2005: { startAdDate: new Date(1948, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1948
    2006: { startAdDate: new Date(1949, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1949
    2007: { startAdDate: new Date(1950, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1950
    2008: { startAdDate: new Date(1951, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31] }, // Apr 14, 1951
    2009: { startAdDate: new Date(1952, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1952
    2010: { startAdDate: new Date(1953, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1953
    2011: { startAdDate: new Date(1954, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1954
    2012: { startAdDate: new Date(1955, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30] }, // Apr 14, 1955
    2013: { startAdDate: new Date(1956, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1956
    2014: { startAdDate: new Date(1957, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1957
    2015: { startAdDate: new Date(1958, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1958
    2016: { startAdDate: new Date(1959, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30] }, // Apr 14, 1959
    2017: { startAdDate: new Date(1960, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1960
    2018: { startAdDate: new Date(1961, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1961
    2019: { startAdDate: new Date(1962, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 13, 1962
    2020: { startAdDate: new Date(1963, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1963
    2021: { startAdDate: new Date(1964, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1964
    2022: { startAdDate: new Date(1965, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30] }, // Apr 13, 1965
    2023: { startAdDate: new Date(1966, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 13, 1966
    2024: { startAdDate: new Date(1967, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1967
    2025: { startAdDate: new Date(1968, 3, 13), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1968
    2026: { startAdDate: new Date(1969, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1969
    2027: { startAdDate: new Date(1970, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 14, 1970
    2028: { startAdDate: new Date(1971, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1971
    2029: { startAdDate: new Date(1972, 3, 13), daysInMonths: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1972
    2030: { startAdDate: new Date(1973, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1973
    2031: { startAdDate: new Date(1974, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 14, 1974
    2032: { startAdDate: new Date(1975, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1975
    2033: { startAdDate: new Date(1976, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1976
    2034: { startAdDate: new Date(1977, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1977
    2035: { startAdDate: new Date(1978, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31] }, // Apr 14, 1978
    2036: { startAdDate: new Date(1979, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1979
    2037: { startAdDate: new Date(1980, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1980
    2038: { startAdDate: new Date(1981, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1981
    2039: { startAdDate: new Date(1982, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30] }, // Apr 14, 1982
    2040: { startAdDate: new Date(1983, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1983
    2041: { startAdDate: new Date(1984, 3, 13), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1984
    2042: { startAdDate: new Date(1985, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1985
    2043: { startAdDate: new Date(1986, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30] }, // Apr 14, 1986
    2044: { startAdDate: new Date(1987, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1987
    2045: { startAdDate: new Date(1988, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 13, 1988
    2046: { startAdDate: new Date(1989, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 1989
    2047: { startAdDate: new Date(1990, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1990
    2048: { startAdDate: new Date(1991, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1991
    2049: { startAdDate: new Date(1992, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30] }, // Apr 13, 1992
    2050: { startAdDate: new Date(1993, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 13, 1993
    2051: { startAdDate: new Date(1994, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1994
    2052: { startAdDate: new Date(1995, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1995
    2053: { startAdDate: new Date(1996, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30] }, // Apr 13, 1996
    2054: { startAdDate: new Date(1997, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 13, 1997
    2055: { startAdDate: new Date(1998, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1998
    2056: { startAdDate: new Date(1999, 3, 14), daysInMonths: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30] }, // Apr 14, 1999
    2057: { startAdDate: new Date(2000, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 2000
    2058: { startAdDate: new Date(2001, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 14, 2001
    2059: { startAdDate: new Date(2002, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2002
    2060: { startAdDate: new Date(2003, 3, 14), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2003
    2061: { startAdDate: new Date(2004, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 2004
    2062: { startAdDate: new Date(2005, 3, 14), daysInMonths: [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31] }, // Apr 14, 2005
    2063: { startAdDate: new Date(2006, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2006
    2064: { startAdDate: new Date(2007, 3, 14), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2007
    2065: { startAdDate: new Date(2008, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 2008
    2066: { startAdDate: new Date(2009, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31] }, // Apr 14, 2009
    2067: { startAdDate: new Date(2010, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2010
    2068: { startAdDate: new Date(2011, 3, 14), daysInMonths: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2011
    2069: { startAdDate: new Date(2012, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 2012
    2070: { startAdDate: new Date(2013, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30] }, // Apr 14, 2013
    2071: { startAdDate: new Date(2014, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2014
    2072: { startAdDate: new Date(2015, 3, 14), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2015
    2073: { startAdDate: new Date(2016, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] }, // Apr 13, 2016
    2074: { startAdDate: new Date(2017, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2017
    2075: { startAdDate: new Date(2018, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2018
    2076: { startAdDate: new Date(2019, 3, 14), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30] }, // Apr 14, 2019
    2077: { startAdDate: new Date(2020, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 13, 2020
    2078: { startAdDate: new Date(2021, 3, 14), daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2021
    2079: { startAdDate: new Date(2022, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] }, // Apr 14, 2022
    2080: { startAdDate: new Date(2023, 3, 14), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30] }, // Apr 14, 2023
    2081: { startAdDate: new Date(2024, 3, 13), daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] }, // Apr 13, 2024
    2082: { startAdDate: new Date(2025, 3, 14), daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] },  // Apr 14, 2025
    2083: { startAdDate: new Date(2026, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,31] },
    2084: { startAdDate: new Date(2027, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
    2085: { startAdDate: new Date(2028, 3, 13), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2086: { startAdDate: new Date(2029, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2087: { startAdDate: new Date(2030, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
    2088: { startAdDate: new Date(2031, 3, 15), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2089: { startAdDate: new Date(2032, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2090: { startAdDate: new Date(2033, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
    2091: { startAdDate: new Date(2034, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2092: { startAdDate: new Date(2035, 3, 15), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2093: { startAdDate: new Date(2036, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
    2094: { startAdDate: new Date(2037, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2095: { startAdDate: new Date(2038, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2096: { startAdDate: new Date(2039, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
    2097: { startAdDate: new Date(2040, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2098: { startAdDate: new Date(2041, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] },
    2099: { startAdDate: new Date(2042, 3, 14), daysInMonths: [31,32,30,32,31,30,29,30,29,30,30,30] },
    2100: { startAdDate: new Date(2043, 3, 14), daysInMonths: [31,31,31,32,31,30,29,30,29,30,30,30] }
};

export default bsCalendarData;
