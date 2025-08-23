
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Table, Card, Statistic, Row, Col, Input, Tooltip, message, Radio } from 'antd';
import { CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { AuthContext } from '../context/AuthContext';
import { getArbDetails, getArbStatistic, getArbStatisticV2 } from '../data/apiArbDetails';
import { getIDBValue, setIDBValue, removeIDBValue } from '../utils/indexDB';


const addrLike = (key) => key.toLowerCase().includes('hash') || key.toLowerCase().includes('address');
const truncate = (str, len = 6) => (str.length <= 2 * len ? str : `${str.slice(0, len)}…${str.slice(-len)}`);
const renderNumber = (val) => {
  const n = Number(val);
  return Number.isNaN(n) ? val : new Intl.NumberFormat().format(n);
};
const handleCopy = (text) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => message.success(`复制: ${text}`));
  } else {
    const ipt = document.createElement('input');
    ipt.value = text;
    document.body.appendChild(ipt);
    ipt.select();
    document.execCommand('copy');
    document.body.removeChild(ipt);
    message.success(`复制: ${text}`);
  }
};
const renderHash = (text, key) => {
  const k = (key || '').toLowerCase();
  const isTx = k.includes('tx') || k.includes('hash'); 
  const path = isTx ? 'tx' : 'address';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Tooltip title={`在 BscScan 查看${isTx ? '交易' : '地址'}`}>
        <span
          onClick={() => window.open(`https://bscscan.com/${path}/${text}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff', textDecoration: 'underline' }}
        >
          {truncate(text)}
        </span>
      </Tooltip>
      <Tooltip title="复制">
        <CopyOutlined onClick={() => handleCopy(text)} style={{ cursor: 'pointer', color: '#1890ff' }} />
      </Tooltip>
    </span>
  );
};

const ArbDetails = () => {
  const { authToken } = useContext(AuthContext);

  const [details, setDetails] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [builderFilter, setBuilderFilter] = useState('all');
  const [sortedInfo, setSortedInfo] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const MAX_DISPLAY_ROWS = 5000; 

  const fetchAll = async () => {
    try {
      const [detailArr, statObjV2] = await Promise.all([
        getArbDetails(),
        getArbStatisticV2().catch(() => null), 
      ]);

      const sortedDetails = detailArr
        .map(d => ({
          ...d,
          _normalizedBlockNum: Number(String(d.blockNum || 0).replace(/,/g, '')) || 0
        }))
        .sort((a, b) => b._normalizedBlockNum - a._normalizedBlockNum)
        .slice(0, MAX_DISPLAY_ROWS);
      
      setDetails(sortedDetails);

      let finalStats;
      if (statObjV2) {
        finalStats = statObjV2;
      } else {
        finalStats = await getArbStatistic();
      }
      setStats(finalStats);

      if (sortedDetails.length === 0) {
        await Promise.all([removeIDBValue('ARB_DETAILS_CACHE'), removeIDBValue('ARB_STATISTIC_CACHE')]);
      } else {
        await Promise.all([
          setIDBValue('ARB_DETAILS_CACHE', JSON.stringify(sortedDetails)),
          setIDBValue('ARB_STATISTIC_CACHE', JSON.stringify(finalStats)),
        ]);
      }
    } catch {
      message.error('获取数据失败，已回退到本地缓存');
      const cacheDetails = await getIDBValue('ARB_DETAILS_CACHE');
      const cacheStats = await getIDBValue('ARB_STATISTIC_CACHE');
      if (cacheDetails) setDetails(JSON.parse(cacheDetails));
      if (cacheStats) setStats(JSON.parse(cacheStats));
    }
  };

  useEffect(() => {
    let alive = true;
    let timer = null;
    let fetchId = 0;

    const tick = async () => {
      const id = ++fetchId;
      await fetchAll();
      if (alive && id === fetchId) {
        timer = setTimeout(tick, 5000);
      }
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [authToken]);


  const columns = useMemo(() => {
    if (!details.length) return [];

    const sampleCount = Math.min(details.length, 50);
    const keySet = new Set();
    for (let i = 0; i < sampleCount; i++) {
      Object.keys(details[i]).forEach(k => {
        if (k !== 'key' && k !== '_normalizedBlockNum') keySet.add(k);
      });
    }
    const keys = Array.from(keySet);
    const sample = details[0]; 

    const baseCols = keys.map((key) => {
      const val = sample[key];

      if (typeof val === 'string' && addrLike(key)) {
        return { title: key, dataIndex: key, key, width: 200, render: (v) => renderHash(v, key) };
      }
      
      if (key === 'profit') {
        return {
          title: 'profit',
          dataIndex: 'profit',
          key: 'profit',
          sorter: true,
          render: (v) => {
            const n = Number(v);
            return Number.isNaN(n) ? v : ((n / 1e18) / 0.275).toFixed(5);
          },
        };
      }

      if (key === 'blockNum') {
        return {
          title: 'blockNum',
          dataIndex: 'blockNum',
          key: 'blockNum',
          sorter: true,
          sortOrder: sortedInfo.columnKey === 'blockNum' ? sortedInfo.order : null,
          sortDirections: ['descend', 'ascend'],
          render: (v) => String(v).replace(/,/g, ''),
        };
      }

      if (!Number.isNaN(Number(val))) {
        return { title: key, dataIndex: key, key, sorter: true, render: renderNumber };
      }

      return { title: key, dataIndex: key, key };
    });

    const fixedKeyCol = {
      title: 'tx hash',
      dataIndex: 'key',
      key: 'redis_key',
      fixed: 'left',
      width: 260,
      render: (v) => renderHash(v, 'tx_hash'), 
    };

    return [fixedKeyCol, ...baseCols];
  }, [details.length, sortedInfo]); 

  const filtered = useMemo(() => {
    let res = details;
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      res = res.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(kw)));
    }
    if (builderFilter !== 'all') {
      res = res.filter((r) => {
        const builder = (r.builder || '').toLowerCase();
        return builderFilter === '48club' ? builder.includes('48club') : builder.includes('blockrazor');
      });
    }
    return res;
  }, [details, search, builderFilter]);

  const sortedData = useMemo(() => {
    if (!sortedInfo.order) return filtered;

    const { columnKey, order } = sortedInfo;
    const factor = order === 'ascend' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (columnKey === 'blockNum') {
        return factor * ((a._normalizedBlockNum || 0) - (b._normalizedBlockNum || 0));
      }
      const va = Number(a[columnKey] || 0);
      const vb = Number(b[columnKey] || 0);
      return factor * (va - vb);
    });
  }, [filtered, sortedInfo]);

  useEffect(() => {
    const total = Math.ceil(sortedData.length / pageSize);
    if (currentPage > total) setCurrentPage(total || 1);
  }, [sortedData.length, pageSize, currentPage]);


  const statCards = useMemo(() => {
    if (stats.__v2) {
      const s = stats;
      const valOrNA = (v) => (v == null ? '无统计' : v);


      return (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="48club arb执行比例" value={s.bnb48.ratio} precision={2} suffix="%" valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="48club arb总盈利 (燃烧之前)" value={s.bnb48.profit_bnb} precision={4} suffix=" BNB" valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="48club arb上链次数" value={s.bnb48.count} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="48club arb返利" value={s.bnb48.refund_bnb} precision={4} suffix=" BNB" valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="blockrazor arb执行比例" value={s.blockrazor.ratio} precision={2} suffix="%" valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="blockrazor arb总盈利 (燃烧之前)" value={s.blockrazor.profit_bnb} precision={4} suffix=" BNB" valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="blockrazor arb上链次数" value={s.blockrazor.count} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="blockrazor arb返利" value={s.blockrazor.refund_bnb} precision={4} suffix=" BNB" valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="others arb from blockrazor 执行比例" value={s.others.ratio} precision={2} suffix="%" valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="others arb 总盈利" value={valOrNA(s.others.profit_bnb)} valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="others arb 上链次数" value={s.others.count} valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card>
                <Statistic title="others arb from blockrazor 返利" value={s.others.refund_bnb} precision={4} suffix=" BNB" valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
          </Row>
        </>
      );
    }

    let b48Cnt = 0, brCnt = 0, othersCnt = 0, b48Profit = 0, brProfit = 0, b48Refund = 0, brRefund = 0, othersRefund = 0;
    Object.entries(stats).forEach(([k, v]) => {
      if (k === 'bnb48_total_profit') b48Profit = v / 1e18 / 0.275;
      if (k === 'blockrazor_total_profit') brProfit = v / 1e18 / 0.275;
      if (k === 'bnb48_arb_num') b48Cnt = v;
      if (k === 'blockrazor_arb_num') brCnt = v;
      if (k === 'others_arb_num') othersCnt = v;
      if (k === 'bnb48_binanceWallet_refund') b48Refund = v; // 已经是BNB单位
      if (k === 'blockrazor_binanceWallet_refund') brRefund = v; // 已经是BNB单位
      if (k === 'others_binanceWallet_refund') othersRefund = v; // 已经是BNB单位
    });
    const totalCnt = b48Cnt + brCnt + othersCnt || 1;
    const ratio48 = ((b48Cnt / totalCnt) * 100).toFixed(2);
    const ratioBr = ((brCnt / totalCnt) * 100).toFixed(2);
    const ratioOth = ((othersCnt / totalCnt) * 100).toFixed(2);

    return (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={6}>
            <Card><Statistic title="48club arb执行比例" value={ratio48} precision={2} suffix="%" valueStyle={{ color: '#3f8600' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="48club arb总盈利 (燃烧之前)" value={b48Profit} precision={4} suffix=" BNB" valueStyle={{ color: '#3f8600' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="48club arb上链次数" value={b48Cnt} valueStyle={{ color: '#3f8600' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="48club arb返利" value={b48Refund} precision={4} suffix=" BNB" valueStyle={{ color: '#3f8600' }} /></Card>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={6}>
            <Card><Statistic title="blockrazor arb执行比例" value={ratioBr} precision={2} suffix="%" valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="blockrazor arb总盈利 (燃烧之前)" value={brProfit} precision={4} suffix=" BNB" valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="blockrazor arb上链次数" value={brCnt} valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="blockrazor arb返利" value={brRefund} precision={4} suffix=" BNB" valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={6}>
            <Card><Statistic title="others arb from blockrazor 执行比例" value={ratioOth} precision={2} suffix="%" valueStyle={{ color: '#fa8c16' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="others arb 总盈利" value="无统计" valueStyle={{ color: '#fa8c16' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="others arb 上链次数" value={othersCnt} valueStyle={{ color: '#fa8c16' }} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card><Statistic title="others arb from blockrazor 返利" value={othersRefund} precision={4} suffix=" BNB" valueStyle={{ color: '#fa8c16' }} /></Card>
          </Col>
        </Row>
      </>
    );
  }, [stats]);


  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>48 club Internal Monitor</h2>
      {statCards}

      {/* 过滤器 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          allowClear
          placeholder="搜索"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <Radio.Group value={builderFilter} onChange={(e) => setBuilderFilter(e.target.value)} buttonStyle="solid" style={{ marginLeft: 16 }}>
          <Radio.Button value="all">全部</Radio.Button>
          <Radio.Button value="48club">仅 48club</Radio.Button>
          <Radio.Button value="blockrazor">仅 blockrazor</Radio.Button>
        </Radio.Group>
      </div>

      {/* 表格 */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          overflowX: 'auto',
        }}
      >
        <Table
          tableLayout="fixed"
          columns={columns}
          dataSource={sortedData}
          rowKey={(r) => r.key}
          locale={{
            triggerDesc: '点击按降序排序',
            triggerAsc: '点击按升序排序',
            cancelSort: '取消排序',
            emptyText: '暂无数据',
          }}
          pagination={{
            current: currentPage,
            pageSize,
            total: sortedData.length,
            showQuickJumper: true,
            showSizeChanger: true,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
          }}
          onChange={(_, __, sorter) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            setSortedInfo(s?.order ? s : {});
          }}
          scroll={{ x: 1000, y: 500 }}
          components={{
            header: {
              cell: (props) => (
                <th
                  {...props}
                  style={{
                    backgroundColor: '#fff',
                    borderBottom: '1px solid #e8e8e8',
                  }}
                />
              ),
            },
          }}
        />
      </div>
    </div>
  );
};

export default ArbDetails;
