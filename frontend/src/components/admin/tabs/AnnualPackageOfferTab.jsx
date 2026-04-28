import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../hooks/use-toast';
import { Package, Loader2 } from 'lucide-react';
import { HomeComingPackageEditor } from './HomeComingPackageEditor';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Dedicated admin page: Home Coming single annual bundle — catalog offer validity, price, optional anchored start day.
 */
export default function AnnualPackageOfferTab() {
  const { toast } = useToast();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPkg, setSavingPkg] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await axios.get(`${API}/admin/subscribers/packages`);
      setPackages(pRes.data || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not load packages', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePkg = async (pkgData) => {
    setSavingPkg(true);
    try {
      if (pkgData.package_id) {
        await axios.put(`${API}/admin/subscribers/packages/${pkgData.package_id}`, pkgData);
      } else {
        await axios.post(`${API}/admin/subscribers/packages`, pkgData);
      }
      toast({ title: 'Package saved' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error saving package', variant: 'destructive' });
    } finally {
      setSavingPkg(false);
    }
  };

  const handleDeletePkg = async (pkgId) => {
    if (!window.confirm(`Delete package ${pkgId}?`)) return;
    try {
      await axios.delete(`${API}/admin/subscribers/packages/${pkgId}`);
      toast({ title: 'Package deleted' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleNewVersion = async (pkgId) => {
    try {
      const res = await axios.post(`${API}/admin/subscribers/packages/${pkgId}/new-version`);
      toast({ title: `New version created: ${res.data.new_package_id}` });
      fetchData();
    } catch (err) {
      toast({ title: 'Error creating version', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
        <Loader2 className="animate-spin" size={22} />
        <span className="text-sm">Loading catalog…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl" data-testid="annual-package-offer-tab">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Package size={22} className="text-[#5D3FD3]" aria-hidden />
          Home Coming — catalog offer
        </h2>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          One product: the bundled annual membership. <strong>Offer valid from / to</strong> is when this price may be sold.{' '}
          <strong>Subscription length</strong> is how long each member&apos;s access runs after their start date. Optional <strong>day of month</strong>{' '}
          (e.g. 3) powers quick-picks for membership start on Sacred Exchange and subscriber forms.
        </p>
      </div>

      {packages.length === 0 ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No PKG rows found — seed will appear on next API call, or contact support.</p>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <HomeComingPackageEditor
              key={pkg.package_id}
              pkg={pkg}
              onSave={handleSavePkg}
              saving={savingPkg}
              onDelete={packages.length > 1 ? handleDeletePkg : null}
              onNewVersion={handleNewVersion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
