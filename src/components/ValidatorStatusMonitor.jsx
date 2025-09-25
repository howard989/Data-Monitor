import React, { useState, useEffect } from 'react';
import { Card, Space, Row, Col, Button, Table, Empty, message, Typography, Radio, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../data/apiClient';

const { Text, Title } = Typography;

const ValidatorStatusMonitor = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [timeRange, setTimeRange] = useState('1h');
    const [hasAccess, setHasAccess] = useState(false);
    const navigate = useNavigate();

    const checkAccess = async () => {
        try {
            const response = await authFetch('/api/validator/validator-access');
            if (!response.ok) {
                throw new Error('Access check failed');
            }
            const result = await response.json();
            if (!result.hasAccess) {
                message.error('No permission to access this page');
                navigate('/data-center');
                return false;
            }
            setHasAccess(true);
            return true;
        } catch (error) {
            message.error('Failed to check access');
            navigate('/data-center');
            return false;
        }
    };

    const fetchValidatorStatus = async () => {
        setLoading(true);
        try {
            const response = await authFetch(`/api/validator/validator-status?timeRange=${timeRange}`);
            if (!response.ok) {
                if (response.status === 403) {
                    message.error('Access denied');
                    navigate('/data-center');
                    return;
                }
                throw new Error('Failed to fetch data');
            }
            const result = await response.json();
            setData(result);
        } catch (error) {
            message.error('Failed to load validator status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            const canAccess = await checkAccess();
            if (canAccess) {
                fetchValidatorStatus();
            }
        })();
    }, []);

    useEffect(() => {
        if (hasAccess) {
            fetchValidatorStatus();
        }
    }, [timeRange, hasAccess]);

    const handleRefresh = () => {
        fetchValidatorStatus();
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const columns = [
        {
            title: '#',
            key: 'rank',
            width: 60,
            render: (_, __, index) => (currentPage - 1) * pageSize + index + 1
        },
        {
            title: 'Validator',
            dataIndex: 'validator_name',
            key: 'validator_name',
            render: (name, record) => (
                <a
                    href={`https://bscscan.com/address/${record.stake_address}`}
                    target="_blank"
                    rel="noreferrer"
                >
                    {name}
                </a>
            )
        },
        {
            title: 'Total BNB Staked',
            dataIndex: 'total_staked_bnb',
            key: 'total_staked_bnb',
            render: (value) => (
                <Text strong>{Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BNB</Text>
            ),
            sorter: (a, b) => Number(a.total_staked_bnb) - Number(b.total_staked_bnb)
        },
        {
            title: (
                <Tooltip title="APY = (小时收益 × 24 × 365) / 质押总量 × 100%">
                    APY
                </Tooltip>
            ),
            dataIndex: 'apy',
            key: 'apy',
            render: (value) => (
                <Text style={{ color: Number(value) > 0 ? '#52c41a' : '#666' }}>
                    {value}%
                </Text>
            ),
            sorter: (a, b) => Number(a.apy) - Number(b.apy)
        },
        {
            title: `Rewards (${timeRange})`,
            dataIndex: 'rewards_bnb',
            key: 'rewards_bnb',
            render: (value) => `${Number(value).toFixed(8)} BNB`
        },
        {
            title: 'Daily Rewards (Expected)',
            dataIndex: 'daily_rewards_bnb',
            key: 'daily_rewards_bnb',
            render: (value) => `${Number(value).toFixed(8)} BNB`
        }
    ];

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Title level={2} style={{ marginBottom: '24px' }}>Validator Status Monitor</Title>

                <Card className="mb-6" style={{ background: '#fafafa' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div>
                            <Title level={3} style={{ margin: 0, fontSize: '20px', color: '#F3BA2F' }}>
                                BNB CHAIN STAKING
                            </Title>
                        </div>

                        {data && (
                            <Row gutter={[24, 24]}>
                                <Col xs={24} sm={8}>
                                    <div>
                                        <Text type="secondary">Total BNB Staked</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F3BA2F' }}>
                                            {Number(data.summary.total_staked_bnb).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })} BNB
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <div>
                                        <Text type="secondary">Validators</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                            {data.summary.active_validators} / {data.summary.total_validators}
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <div>
                                        <Text type="secondary">Avg APY</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                                            {data.summary.avg_apy}%
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        )}
                    </Space>
                </Card>

                <Card className="mb-6">
                    <Space style={{ marginBottom: '16px' }}>
                        <Radio.Group
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="10m">10 Minutes</Radio.Button>
                            <Radio.Button value="1h">1 Hour</Radio.Button>
                            <Radio.Button value="24h">24 Hours</Radio.Button>
                            <Radio.Button value="7d">7 Days</Radio.Button>
                        </Radio.Group>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={handleRefresh}
                            loading={loading}
                            style={{ background: '#F3BA2F', borderColor: '#F3BA2F', color: 'white' }}
                        >
                            Refresh
                        </Button>
                    </Space>

                    {data && data.validators ? (
                        <Table
                            dataSource={data.validators}
                            columns={columns}
                            loading={loading}
                            pagination={{
                                current: currentPage,
                                pageSize: pageSize,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '25', '50'],
                                onChange: (page, size) => {
                                    setCurrentPage(page);
                                    if (size !== pageSize) {
                                        setPageSize(size);
                                        setCurrentPage(1);
                                    }
                                },
                                onShowSizeChange: (current, size) => {
                                    setPageSize(size);
                                    setCurrentPage(1);
                                }
                            }}
                            rowKey={(r) => r.validator_name + (r.stake_address || '')}
                            size="middle"
                        />
                    ) : (
                        !loading && <Empty description="No data available" />
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ValidatorStatusMonitor;
