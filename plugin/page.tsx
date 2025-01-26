'use client'

import { useState } from 'react'
import { Monitor, Scan, CreditCard, FileText, RotateCw, QrCode } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RepeatedVerificationStep } from "@/components/repeated-verification-step"
import { FaceScanStep } from "@/components/face-scan-step"
import { BankIDStep } from "@/components/bank-id-step"
import { MojeIDStep } from "@/components/moje-id-step"
import { IDScanStep } from "@/components/id-scan-step"
import { OtherDeviceStep } from "@/components/other-device-step"
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const verificationMethods = [
  {
    id: "facescan",
    icon: <Scan className="w-8 h-8" />,
    title: "FaceScan",
    description:
      "Rychlé a bezpečné ověření pomocí skenování obličeje. Není potřeba žádný doklad, stačí pouze váš obličej.",
  },
  {
    id: "bankid",
    icon: <CreditCard className="w-8 h-8" />,
    title: "BankID",
    description:
      "Ověření pomocí vaší bankovní identity. Bezpečný způsob s využitím vašeho internetového bankovnictví.",
  },
  {
    id: "mojeid",
    icon: <FileText className="w-8 h-8" />,
    title: "MojeID",
    description:
      "Využijte svou státem garantovanou identitu MojeID pro rychlé a spolehlivé ověření věku.",
  },
  {
    id: "ocr",
    icon: <Monitor className="w-8 h-8" />,
    title: "Sken dokladu",
    description:
      "Naskenujte svůj občanský průkaz nebo cestovní pas. Podporujeme všechny typy oficiálních dokladů.",
  },
  {
    id: "revalidate",
    icon: <RotateCw className="w-8 h-8" />,
    title: "Opakované ověření",
    description:
      "Již ověření uživatelé mohou využít rychlé znovu-ověření bez nutnosti dodatečných dokumentů.",
  },
  {
    id: "other_device",
    icon: <QrCode className="w-8 h-8" />,
    title: "Jiné zařízení",
    description:
      "Pokračujte v ověření na jiném zařízení. Stačí naskenovat QR kód a dokončit proces kde vám to vyhovuje.",
  },
]

export default function AgeVerificationPage() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const searchParams = useSearchParams();
  const apiKey = searchParams.get('apiKey')

    useEffect(() => {
        if (!apiKey) {
            console.error("apiKey is missing in the query parameters.");
        }
    }, [apiKey])

  const handleMethodSelect = (methodId: string) => {
    setSelectedMethod(methodId)
  }

  const handleBack = () => {
    setSelectedMethod(null)
  }

  const renderSelectedMethod = () => {
    switch (selectedMethod) {
      case 'facescan':
        return <FaceScanStep onBack={handleBack} apiKey={apiKey} />
      case 'bankid':
        return <BankIDStep onBack={handleBack} apiKey={apiKey} />
      case 'mojeid':
        return <MojeIDStep onBack={handleBack} apiKey={apiKey} />
      case 'ocr':
        return <IDScanStep onBack={handleBack} apiKey={apiKey} />
      case 'revalidate':
        return <RepeatedVerificationStep onBack={handleBack} apiKey={apiKey} />
      case 'other_device':
        return <OtherDeviceStep onBack={handleBack} apiKey={apiKey} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-primary-light/10">
      <div className="container px-4 py-12 mx-auto">
        {selectedMethod ? (
          renderSelectedMethod()
        ) : (
          <div className="grid lg:grid-cols-[1fr,2fr] gap-12 items-start">
            <div className="space-y-6 bg-primary text-white p-8 rounded-lg shadow-lg">
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-4">
                  Ověření věku
                  <br />
                  jednoduše a bezpečně
                </h1>
                <p className="text-lg opacity-90">
                  Vyberte si z několika způsobů ověření věku. Všechny metody jsou plně
                  automatizované, bezpečné a šifrované. Proces zabere jen pár minut.
                </p>
              </div>
              <Button size="lg" className="w-full sm:w-auto bg-white text-primary hover:bg-primary-light hover:text-white">
                Více informací
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {verificationMethods.map((method) => (
                <Card
                  key={method.id}
                  className="group relative overflow-hidden transition-all hover:shadow-md border-primary-light"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 text-primary">{method.icon}</div>
                    <h2 className="font-semibold mb-2 text-primary text-xl">{method.title}</h2>
                    <p className="text-sm text-gray-light mb-4">
                      {method.description}
                    </p>
                    <Button
                      variant="link"
                      className="p-0 h-auto font-normal text-primary hover:text-primary-light"
                      onClick={() => handleMethodSelect(method.id)}
                    >
                      Vybrat metodu →
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}