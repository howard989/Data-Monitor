import React, { useMemo, useState } from 'react';
import { Segmented, Card, Tag, Row, Col, Button, Space } from 'antd';
import { AppstoreOutlined, BlockOutlined, BuildOutlined } from '@ant-design/icons';

function DataCenter() {

  const [category, setCategory] = useState('all');

  const SEGMENTED_OPTIONS = [
    { label: <Space size={6}><AppstoreOutlined /><span>All</span></Space>, value: 'all' },
    { label: <Space size={6}><BlockOutlined /><span>block</span></Space>, value: 'block' },
    { label: <Space size={6}><BuildOutlined /><span>builder</span></Space>, value: 'builder' },
  ];


  const items = useMemo(
    () => [
      {
        title: 'Sandwich Stats',
        description: 'Block Sandwich Attack Monitor',
        categoryKey: 'block',
        chains: ['BNB'],
        enabled: true,
        href: '/sandwich-stats',
      },
      {
        title: 'Block Stats',
        description: 'Builder Block Production & Market Share',
        categoryKey: 'builder',
        chains: ['BNB'],
        enabled: true,
        href: '/block-stats',
      },
      {
        title: 'Refund Status',
        description: 'Check the status of refunds for transactions',
        categoryKey: 'builder',
        chains: ['BNB'],
        enabled: true,
        href: '/refund-status',
      },
    ],
    []
  );

  const chainTagColor = (chain) => {
    switch (chain) {
      case 'EVM':
        return 'processing';
      case 'Solana':
        return 'success';
      case 'BNB':
      default:
        return 'warning';
    }
  };

  const displayed = useMemo(() => {
    const list = category === 'all' ? items : items.filter(i => i.categoryKey === category);
    return list.slice().sort((a, b) => Number(b.enabled) - Number(a.enabled));
  }, [category, items]);


  const categoryIcon = (key) => {
    if (key === 'block') return <BlockOutlined />;
    if (key === 'builder') return <BuildOutlined />;
    return <AppstoreOutlined />;
  };

  return (
    <div className="DataCenter-root min-h-[calc(100vh-66px)] overflow-y-auto">

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex justify-center mb-6 sm:mb-8">
          <Segmented
            className="DataCenter-seg w-full max-w-xl"
            options={SEGMENTED_OPTIONS}
            value={category}
            onChange={(val) => setCategory(String(val))}
            block
          />
        </div>


        <Row gutter={[16, 16]}>
          {displayed.map((item, idx) => (
            <Col xs={24} md={12} key={idx}>
              <Card
                hoverable
                className="bg-white border border-gray-200 rounded"
                bodyStyle={{ padding: 16 }}
              >
                <div className="relative">
                  <div className="absolute right-3 top-3 text-gray-300 text-lg">
                    {categoryIcon(item.categoryKey)}
                  </div>

                  <div className="pr-28 pb-10">
                    <div className="text-gray-900 text-base md:text-lg font-semibold mb-1">
                      {item.title}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 mb-3">
                      {item.description}
                    </div>
                    <Space size={8} wrap>
                      {item.chains.map((c, i) => (
                        <Tag key={i} color={chainTagColor(c)}>{c}</Tag>
                      ))}
                      <Tag bordered>{item.categoryKey}</Tag>
                    </Space>
                  </div>

                  <div className="absolute right-3 bottom-1">
                    {item.enabled ? (
                      <Button
                        type="primary"
                        size="middle"
                        href={item.href}
                      >
                        View
                      </Button>
                    ) : (
                      <span className="text-[11px] sm:text-xs text-gray-400 uppercase tracking-wider">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}

export default DataCenter;
